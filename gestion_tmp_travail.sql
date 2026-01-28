-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Hôte : localhost:8889
-- Généré le : mar. 27 jan. 2026 à 13:46
-- Version du serveur : 8.0.35
-- Version de PHP : 8.2.20

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de données : `gestion_tmp_travail`
--

-- --------------------------------------------------------

--
-- Structure de la table `auth_token`
--

CREATE TABLE `auth_token` (
  `id` int NOT NULL,
  `email` varchar(255) NOT NULL,
  `token_hash` varchar(255) NOT NULL,
  `purpose` enum('invited_signup','factory_signup','reset_password') NOT NULL,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Structure de la table `conges_spec`
--

CREATE TABLE `conges_spec` (
  `id_demande` int NOT NULL,
  `nature` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `justificatif` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `demande`
--

CREATE TABLE `demande` (
  `id_demande` int NOT NULL,
  `id_user` int DEFAULT NULL,
  `type` enum('Arrêt Maladie','Congés Payés','Heures Supplémentaire','Congé spécifique') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Congés Payés',
  `date_demande` date NOT NULL,
  `date_debut` datetime NOT NULL,
  `date_fin` datetime NOT NULL,
  `statut_demande` enum('En Attente','Refusée','Acceptée') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'En Attente',
  `motif` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `historique_solde`
--

CREATE TABLE `historique_solde` (
  `id_historique` int NOT NULL,
  `id_user_target` int NOT NULL,
  `id_user_actor` int NOT NULL,
  `type_solde` varchar(50) DEFAULT NULL,
  `valeur_modif` decimal(10,2) DEFAULT NULL,
  `nouveau_solde` decimal(10,2) DEFAULT NULL,
  `date_modif` datetime NOT NULL,
  `motif` varchar(255) DEFAULT NULL,
  `date_action` datetime DEFAULT NULL,
  `duree_reelle` decimal(5,2) DEFAULT '0.00'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Structure de la table `maladie_spec`
--

CREATE TABLE `maladie_spec` (
  `id_demande` int NOT NULL,
  `justificatif` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `user`
--

CREATE TABLE `user` (
  `id_user` int NOT NULL,
  `nom` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `prenom` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `mail` varchar(150) COLLATE utf8mb4_general_ci NOT NULL,
  `statut` enum('au travail','en congés','malade') COLLATE utf8mb4_general_ci DEFAULT 'au travail',
  `poste` enum('salarié','cadre','alternant','stagiaire','mi-temps','admin','RH') COLLATE utf8mb4_general_ci DEFAULT 'salarié',
  `date_entree` date DEFAULT NULL,
  `solde_conge` decimal(10,2) DEFAULT '0.00',
  `solde_hsup` decimal(10,2) DEFAULT '0.00',
  `photo` varchar(255) COLLATE utf8mb4_general_ci DEFAULT '/uploads/default.jpeg',
  `mdp` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `user`
--

INSERT INTO `user` (`id_user`, `nom`, `prenom`, `mail`, `statut`, `poste`, `date_entree`, `solde_conge`, `solde_hsup`, `photo`, `mdp`) VALUES
(17, 'utilisateur', 'salarié', 'user@gmail.com', 'au travail', 'salarié', '2026-01-28', 0.00, 0.00, '/uploads/default.jpeg', '$2b$12$JISsJVruyl3oHSlbLFsIvOSxt/4WDoXqHlKIcspvNi.1c2lSAFykW'),
(18, 'utilisateur', 'rh', 'rh@gmail.com', 'au travail', 'RH', '2026-01-28', 0.00, 0.00, '/uploads/default.jpeg', '$2b$12$g0utPS59ZLS5WKONJW1xaO.zeyPwAVyhjHXEmtOlM4OW0B9jM6ToS'),
(19, 'utilisateur', 'admin', 'admin@gmail.com', 'au travail', 'admin', '2026-01-28', 0.00, 0.00, '/uploads/default.jpeg', '$2b$12$L8URTyo.N.K7xLQXLBTJEuaDH5R/esLmCldsHS/4WePaV6a1z71g6');

--
-- Index pour les tables déchargées
--

--
-- Index pour la table `auth_token`
--
ALTER TABLE `auth_token`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_email` (`email`),
  ADD KEY `idx_expires` (`expires_at`);

--
-- Index pour la table `conges_spec`
--
ALTER TABLE `conges_spec`
  ADD PRIMARY KEY (`id_demande`);

--
-- Index pour la table `demande`
--
ALTER TABLE `demande`
  ADD PRIMARY KEY (`id_demande`),
  ADD KEY `id_user` (`id_user`);

--
-- Index pour la table `historique_solde`
--
ALTER TABLE `historique_solde`
  ADD PRIMARY KEY (`id_historique`),
  ADD KEY `id_user_target` (`id_user_target`),
  ADD KEY `id_user_actor` (`id_user_actor`);

--
-- Index pour la table `maladie_spec`
--
ALTER TABLE `maladie_spec`
  ADD PRIMARY KEY (`id_demande`);

--
-- Index pour la table `user`
--
ALTER TABLE `user`
  ADD PRIMARY KEY (`id_user`),
  ADD UNIQUE KEY `mail` (`mail`);

--
-- AUTO_INCREMENT pour les tables déchargées
--

--
-- AUTO_INCREMENT pour la table `auth_token`
--
ALTER TABLE `auth_token`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT pour la table `demande`
--
ALTER TABLE `demande`
  MODIFY `id_demande` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=43;

--
-- AUTO_INCREMENT pour la table `historique_solde`
--
ALTER TABLE `historique_solde`
  MODIFY `id_historique` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=107;

--
-- AUTO_INCREMENT pour la table `user`
--
ALTER TABLE `user`
  MODIFY `id_user` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=20;

--
-- Contraintes pour les tables déchargées
--

--
-- Contraintes pour la table `conges_spec`
--
ALTER TABLE `conges_spec`
  ADD CONSTRAINT `conges_spec_ibfk_1` FOREIGN KEY (`id_demande`) REFERENCES `demande` (`id_demande`) ON DELETE CASCADE;

--
-- Contraintes pour la table `demande`
--
ALTER TABLE `demande`
  ADD CONSTRAINT `demande_ibfk_1` FOREIGN KEY (`id_user`) REFERENCES `user` (`id_user`) ON DELETE CASCADE;

--
-- Contraintes pour la table `historique_solde`
--
ALTER TABLE `historique_solde`
  ADD CONSTRAINT `historique_solde_ibfk_1` FOREIGN KEY (`id_user_target`) REFERENCES `user` (`id_user`) ON DELETE CASCADE,
  ADD CONSTRAINT `historique_solde_ibfk_2` FOREIGN KEY (`id_user_actor`) REFERENCES `user` (`id_user`);

--
-- Contraintes pour la table `maladie_spec`
--
ALTER TABLE `maladie_spec`
  ADD CONSTRAINT `maladie_spec_ibfk_1` FOREIGN KEY (`id_demande`) REFERENCES `demande` (`id_demande`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
