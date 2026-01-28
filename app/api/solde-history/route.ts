import { NextRequest, NextResponse } from "next/server";
import { getDBConnection } from "@/lib/db";
import { RowDataPacket } from "mysql2";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) return NextResponse.json({ error: "UserId manquant" }, { status: 400 });

  const conn = await getDBConnection();
  try {
    const [rows] = await conn.query<RowDataPacket[]>(`
      SELECT 
        h.*,
        u_actor.nom as actor_nom,
        u_actor.prenom as actor_prenom
      FROM historique_solde h
      JOIN user u_actor ON h.id_user_actor = u_actor.id_user
      WHERE h.id_user_target = ?
      ORDER BY h.date_modif DESC
    `, [userId]);

    return NextResponse.json({ success: true, history: rows });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  } finally {
   conn.release();
  }
}