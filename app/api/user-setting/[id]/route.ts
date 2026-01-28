import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
import { getDBConnection } from "@/lib/db";
import { cookies } from "next/headers";
import { RowDataPacket } from "mysql2";
import { updateUserSchema } from "@/lib/validation"; 

export async function DELETE(
  req: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params; 
  const targetId = parseInt(id, 10);

  const cookieStore = await cookies();
  const currentUserIdStr = cookieStore.get("userId")?.value;
  const currentUserId = currentUserIdStr ? parseInt(currentUserIdStr, 10) : null;

  if (currentUserId && currentUserId === targetId) {
    return NextResponse.json(
      { success: false, error: "Impossible de supprimer son propre compte." },
      { status: 403 }
    );
  }

  const connection = await getDBConnection();
  try {
    await connection.query("DELETE FROM user WHERE id_user = ?", [targetId]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Erreur DELETE user:", err);
    return NextResponse.json({ success: false, error: "Erreur suppression" }, { status: 500 });
  } finally {
    connection.release();
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> } 
) {
  const { id } = await params;
  const targetId = parseInt(id, 10);

  if (isNaN(targetId)) {
    return NextResponse.json({ success: false, error: "ID invalide" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const currentUserIdStr = cookieStore.get("userId")?.value;
  const actorId = currentUserIdStr ? parseInt(currentUserIdStr, 10) : null;

  const connection = await getDBConnection();

  try {
    const formData = await req.formData();
    const motif = formData.get("motif") as string | null;
    const dateActionStr = formData.get("date_action") as string | null;

    // Récupération de l'utilisateur actuel
    const [currentRows] = await connection.query<RowDataPacket[]>(
      "SELECT solde_conge, solde_hsup FROM user WHERE id_user = ?",
      [targetId]
    );

    if (currentRows.length === 0) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    const oldUser = currentRows[0] as { solde_conge: number | string; solde_hsup: number | string };

    // Construction des mises à jour
    const updates: string[] = [];
    const values: (string | number)[] = [];
    // IMPORTANT: depuis user-setting on ne peut ni créer ni modifier un mot de passe.
    // Le mot de passe est défini uniquement via le flow d'inscription par token.
    const allowedFields = ["nom","prenom","mail","poste","solde_conge","solde_hsup","date_entree"];

    // ✅ Validation Zod (on ne valide que les champs présents)
    const payload: Record<string, unknown> = {};
    for (const field of allowedFields) {
      const v = formData.get(field);
      if (v !== null && v !== undefined && v.toString().trim() !== "") {
        payload[field] = v.toString();
      }
    }
    const parsed = updateUserSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Payload invalide", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    
    let sensitiveChanged = false;
    let diffConge = 0;
    
    // Variables pour H.Sup
    // rawInputHsup = valeur totale saisie par l'admin
    // deltaHsup = différence (nouveau - ancien)
    let rawInputHsup = 0;
    let deltaHsup = 0;
    let addedMajorated = 0;
    
    // On convertit proprement en Nombre
    let oldSoldeHsup = oldUser.solde_hsup ? Number(oldUser.solde_hsup) : 0;
    
    // Par défaut, le nouveau solde est l'ancien solde (sauf si modifié ci-dessous)
    let newTotalHsup = oldSoldeHsup;

    for (const field of allowedFields) {
      const val = formData.get(field);
      if (val !== null && val !== undefined) {
        const valStr = val.toString();

        if (field === "mail") {
          // Email stocké en clair en BDD (pas de hash)
          updates.push(`${field} = ?`);
          values.push(valStr.toLowerCase().trim());
        } else if (field === "solde_conge") {
          const newVal = parseFloat(valStr);
          const oldSoldeConge = oldUser.solde_conge ? Number(oldUser.solde_conge) : 0;
          
          if (!isNaN(newVal)) {
            diffConge = newVal - oldSoldeConge;
            updates.push(`${field} = ?`);
            values.push(newVal);
          }
        } else if (field === "solde_hsup") {
          rawInputHsup = parseFloat(valStr);
          if (!isNaN(rawInputHsup)) {
            deltaHsup = rawInputHsup - oldSoldeHsup;
          }
        } else {
          updates.push(`${field} = ?`);
          values.push(valStr);
        }
      }
    }

    // --- Gestion des Heures Supplémentaires (User-Setting = AJUSTEMENT MANUEL) ---
    // ✅ Ici on ne veut AUCUNE règle de majoration (15%/25%/50%).
    // L'admin saisit un solde total final, et on applique exactement la différence.
    if (Math.abs(deltaHsup) > 0.001) {
      newTotalHsup = rawInputHsup; // total final saisi
      updates.push(`solde_hsup = ?`);
      values.push(newTotalHsup);
    }

    // --- Gestion Photo ---
    const photoFile = formData.get("photo") as File | null;
    if (photoFile && photoFile.size > 0) {
      try {
        const buffer = Buffer.from(await photoFile.arrayBuffer());
        const cleanName = photoFile.name.replace(/[^a-zA-Z0-9.]/g, "_");
        const fileName = `user_${targetId}_${Date.now()}_${cleanName}`;
        const uploadPath = path.join(process.cwd(), "public/uploads", fileName);
        await writeFile(uploadPath, buffer);
        updates.push(`photo = ?`);
        values.push(`/uploads/${fileName}`);
      } catch (err) {
        console.error("Erreur upload photo:", err);
      }
    }

    // --- Update DB ---
    if (updates.length > 0) {
      const sql = `UPDATE user SET ${updates.join(", ")} WHERE id_user = ?`;
      await connection.query(sql, [...values, targetId]);
    }

    // --- Historique Conge ---
    if (Math.abs(diffConge) > 0.001) {
      const oldCongeVal = oldUser.solde_conge ? Number(oldUser.solde_conge) : 0;
      await connection.query(
        `INSERT INTO historique_solde (id_user_target, id_user_actor, type_solde, valeur_modif, nouveau_solde, date_modif)
         VALUES (?, ?, 'conge', ?, ?, NOW())`,
        [targetId, actorId, diffConge, oldCongeVal + diffConge]
      );
    }

    // --- Historique Hsup (manuel) ---
    if (Math.abs(deltaHsup) > 0.001) {
      const valeurModif = deltaHsup;
      await connection.query(
        `INSERT INTO historique_solde 
         (id_user_target, id_user_actor, type_solde, valeur_modif, nouveau_solde, date_modif, motif, date_action, duree_reelle)
         VALUES (?, ?, 'hsup_manual', ?, ?, NOW(), ?, ?, ?)`,
        [
          targetId,
          actorId,
          valeurModif,
          newTotalHsup,
          null,
          null,
          null,
        ]
      );
    }

    // Déconnexion si changement sensible
    let shouldLogout = false;
    if (actorId === targetId && sensitiveChanged) {
      const cStore = await cookies();
      cStore.delete("userId");
      shouldLogout = true;
    }

    return NextResponse.json({ success: true, logout: shouldLogout });

  } catch (err: any) {
    console.error("ERREUR PATCH USER:", err);
    return NextResponse.json({ success: false, error: err.message || "Erreur serveur" }, { status: 500 });
  } 
}