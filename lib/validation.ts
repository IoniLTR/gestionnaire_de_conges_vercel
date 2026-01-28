import { z } from "zod";

/**
 * Central place for API payload validation.
 * (Server-side validation is what matters for security.)
 */

export const loginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

export const createUserSchema = z.object({
  nom: z.string().min(1),
  prenom: z.string().min(1),
  mail: z.string().email(),
  mdp: z.string().optional().refine((v) => !v || v.length >= 6, { message: "Mot de passe trop court" }),
  poste: z.string().min(1),
  solde_conge: z.coerce.number().min(0),
  solde_hsup: z.coerce.number().min(0),
  date_entree: z.string().min(1),
  // photo handled separately (multipart)
});

export const updateUserSchema = z.object({
  nom: z.string().optional(),
  prenom: z.string().optional(),
  mail: z.string().email().optional(),
  poste: z.string().optional(),
  solde_conge: z.coerce.number().optional(),
  solde_hsup: z.coerce.number().optional(),
  mdp: z.string().optional().refine((v) => !v || v.length >= 6, { message: "Mot de passe trop court" }),
  date_entree: z.string().optional(),
}).strict();

export const createDemandeSchema = z.object({
  type: z.string().min(1),
  date_debut: z.string().min(1),
  date_fin: z.string().min(1),
  motif: z.string().optional(),
  justificatif: z.string().optional(),
});

export const updateDemandeSchema = z.object({
  id_demande: z.coerce.number().int().positive(),
  decision: z.string().min(1),
}).strict();

export const updateSoldeSchema = z.object({
  targetUserId: z.coerce.number().int().positive(),
  type: z.enum(["conge","hsup"]),
  variation: z.coerce.number(),
  motif: z.string().optional(),
  dateAction: z.string().optional(),
}).strict();
