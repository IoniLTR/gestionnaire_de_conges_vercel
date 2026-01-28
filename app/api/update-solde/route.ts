// app/api/update-solde/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDBConnection } from "@/lib/db";
import { updateSoldeSchema } from "@/lib/validation";
import { cookies } from "next/headers";
import { RowDataPacket } from "mysql2";
import { calculateRecoveryHours } from "@/lib/overtimeUtils";

export async function POST(req: NextRequest) {
  try {
    const parsed = updateSoldeSchema.safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Payload invalide", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { targetUserId, type, variation, motif, dateAction } = parsed.data;

    const cookieStore = await cookies();
    const actorIdStr = cookieStore.get("userId")?.value;

    if (!actorIdStr || !targetUserId || !type || variation === undefined) {
      return NextResponse.json({ error: "Données incomplètes" }, { status: 400 });
    }

    // Validation H.Sup :
    // - Crédit (variation > 0) => motif + dateAction obligatoires (pour calcul majorations)
    // - Débit (variation < 0) => on retire exactement la valeur saisie, sans majoration.
    if (type === "hsup") {
      const v = Number(variation);

      if (v > 0) {
        if (!motif || motif.trim() === "") {
          return NextResponse.json({ error: "Motif obligatoire." }, { status: 400 });
        }
        if (!dateAction) {
          return NextResponse.json(
            { error: "Date/Heure obligatoire pour le calcul." },
            { status: 400 }
          );
        }
      }
    }

    const actorId = parseInt(actorIdStr, 10);
    const conn = await getDBConnection();

    try {
      const [actors] = await conn.query<RowDataPacket[]>(
        "SELECT poste FROM user WHERE id_user = ?",
        [actorId]
      );
      if (!actors.length) {
        return NextResponse.json({ error: "Acteur introuvable" }, { status: 403 });
      }

      const role = String(actors[0].poste ?? "").toLowerCase();
      const isAllowed = role === "admin" || role === "rh" || actorId === targetUserId;

      if (!isAllowed) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
      }

      await conn.beginTransaction();

      let finalVariation = Number(variation);
      let dureeReelle = 0;

      // ✅ CALCUL AUTOMATIQUE UNIQUEMENT SI CRÉDIT
      if (type === "hsup") {
        const raw = Number(variation);

        if (raw > 0) {
          dureeReelle = raw; // Durée brute réellement travaillée
          const dateObj = new Date(dateAction as string);
          const result = await calculateRecoveryHours(conn, targetUserId, dateObj, dureeReelle);
          finalVariation = result.toCredit; // crédit majoré
        } else {
          // Débit: on retire exactement (ex: -1 => -1)
          finalVariation = raw;
          dureeReelle = 0;
        }
      }

      // Update User
      const [targets] = await conn.query<RowDataPacket[]>(
        "SELECT solde_conge, solde_hsup FROM user WHERE id_user = ?",
        [targetUserId]
      );
      if (!targets.length) {
        return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
      }

      const currentValRaw =
        type === "conge" ? targets[0].solde_conge : targets[0].solde_hsup;

      const currentVal = Number(currentValRaw);
      const newVal = currentVal + finalVariation;

      const colName = type === "conge" ? "solde_conge" : "solde_hsup";
      await conn.query(`UPDATE user SET ${colName} = ? WHERE id_user = ?`, [
        newVal,
        targetUserId,
      ]);

      // Insert Historique complet
      await conn.query(
        `INSERT INTO historique_solde
          (id_user_target, id_user_actor, type_solde, valeur_modif, nouveau_solde, date_modif, motif, date_action, duree_reelle)
         VALUES (?, ?, ?, ?, ?, NOW(), ?, ?, ?)`,
        [
          targetUserId,
          actorId,
          type,
          finalVariation,
          newVal,
          type === "hsup" && finalVariation > 0 ? motif : null,
          type === "hsup" && finalVariation > 0 ? dateAction : null,
          type === "hsup" && finalVariation > 0 ? dureeReelle : 0,
        ]
      );

      await conn.commit();
      return NextResponse.json({ success: true, newVal, added: finalVariation });
    } catch (err: unknown) {
      await conn.rollback();
      throw err;
    } finally {
      await conn.end();
    }
  } catch (error) {
    console.error("Erreur update-solde:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
