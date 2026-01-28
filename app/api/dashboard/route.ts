import { NextResponse } from 'next/server';
import { getDBConnection } from '@/lib/db';
import { cookies } from 'next/headers';
import type { RowDataPacket } from 'mysql2';

export async function GET() {
  const conn = await getDBConnection();

  try {
    // 1. Récupération de l'utilisateur connecté
    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;

    if (!userId) {
        return NextResponse.json({ error: "Non connecté" }, { status: 401 });
    }

    // 2. Mise à jour automatique des statuts (Lazy update)
    await conn.query(`
      UPDATE user u
      SET statut = CASE
          WHEN EXISTS (SELECT 1 FROM demande d WHERE d.id_user = u.id_user AND d.type = 'Arrêt Maladie' AND d.statut_demande = 'Acceptée' AND NOW() BETWEEN d.date_debut AND d.date_fin) THEN 'malade'
          WHEN EXISTS (SELECT 1 FROM demande d WHERE d.id_user = u.id_user AND d.type IN ('Congés Payés', 'Heures Supplémentaire', 'Congé spécifique') AND d.statut_demande = 'Acceptée' AND NOW() BETWEEN d.date_debut AND d.date_fin) THEN 'en congés'
          ELSE 'au travail'
      END
    `);

    // 3. Auto-accept maladies
    await conn.query(`UPDATE demande SET statut_demande = 'Acceptée' WHERE type = 'Arrêt Maladie' AND statut_demande != 'Acceptée'`);

    // 4. Récupérer les infos de l'utilisateur CONNECTÉ
    const [userRows] = await conn.query<RowDataPacket[]>(`
      SELECT id_user, solde_conge, solde_hsup, nom, prenom, poste, photo 
      FROM user 
      WHERE id_user = ?
    `, [userId]);

    // 5. Récupérer toutes les demandes (avec motif et justificatifs)
    const [demandeRows] = await conn.query<RowDataPacket[]>(`
      SELECT 
        d.*, 
        u.nom, 
        u.prenom, 
        u.photo,
        COALESCE(m.justificatif, c.justificatif) as justificatif, 
        c.nature
      FROM demande d
      JOIN user u ON d.id_user = u.id_user
      LEFT JOIN maladie_spec m ON d.id_demande = m.id_demande
      LEFT JOIN conges_spec c ON d.id_demande = c.id_demande
      ORDER BY d.date_demande DESC
    `);

    // 6. Filtres dynamiques
    const [typesObserved] = await conn.query<RowDataPacket[]>(`SELECT DISTINCT type FROM demande`);
    const [statuts]       = await conn.query<RowDataPacket[]>(`SELECT DISTINCT statut_demande FROM demande`);
    const [noms]          = await conn.query<RowDataPacket[]>(`SELECT DISTINCT nom FROM user`);
    const [dates]         = await conn.query<RowDataPacket[]>(`SELECT DISTINCT date_demande FROM demande ORDER BY date_demande DESC`);

    const [enumTypeRows] = await conn.query<RowDataPacket[]>(`SHOW COLUMNS FROM demande LIKE 'type'`);
    const enumSpec = enumTypeRows?.[0]?.Type as string | undefined; 
    const typesAll = enumSpec ? (enumSpec.match(/'([^']+)'/g) || []).map(s => s.slice(1, -1)) : [];
    typesAll.sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'accent' }));

    return NextResponse.json({
      user: userRows[0] ?? null,
      demandes: demandeRows,
      filters: { types: typesObserved, typesAll, statuts, noms, dates },
    });
  } catch (error) {
    console.error('Erreur /api/dashboard:', error);
    return NextResponse.error();
  } finally {
    await conn.end();
  }
}