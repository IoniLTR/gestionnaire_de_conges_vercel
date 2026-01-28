# Gestion des congés & heures supplémentaires – Application Next.js

## 📌 Présentation générale

Ce projet est une application web développée avec **Next.js** permettant de gérer :

* les **congés** des salariés,
* les **heures supplémentaires** et leur récupération,
* les **utilisateurs** (création, modification, gestion des soldes),
* les **rôles** (Utilisateur / Admin / RH).

L’application est pensée pour un usage **entreprise**, avec une gestion sécurisée des accès, des droits et des données sensibles.

---

## 🚀 Installation du projet en local

### 1️⃣ Prérequis

* Node.js (version recommandée : >= 18)
* npm
* MAMP (ou tout autre serveur MySQL local)

---

### 2️⃣ Installation des dépendances

À la racine du projet :

```bash
npm install
```

---

### 3️⃣ Configuration des variables d’environnement

Créer un fichier **`.env`** à la racine du projet et y renseigner les variables suivantes selon votre environnement local.

---

#### ▶️ Configuration avec **MAMP**

```env
# Base de données (MAMP)
DB_HOST=127.0.0.1
DB_PORT=8889
DB_USER=root
DB_PASSWORD=root
DB_NAME=gestion_tmp_travail

# SMTP (envoi des emails)
SMTP_HOST=smtp.ze-com.com
SMTP_PORT=587
SMTP_USER=tonadresse@ze-com.com
SMTP_PASS=motdepasse_application
SMTP_FROM="Ze-Com <tonadresse@ze-com.com>"
```

---

#### ▶️ Configuration avec **XAMPP**

```env
# Base de données (XAMPP)
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=gestion_tmp_travail

# SMTP (envoi des emails)
SMTP_HOST=smtp.ze-com.com
SMTP_PORT=587
SMTP_USER=tonadresse@ze-com.com
SMTP_PASS=motdepasse_application
SMTP_FROM="Ze-Com <tonadresse@ze-com.com>"
```

env

# Base de données (MAMP)

DB_HOST=127.0.0.1
DB_PORT=8889
DB_USER=root
DB_PASSWORD=root
DB_NAME=gestion_tmp_travail

# SMTP (envoi des emails)

SMTP_HOST=smtp.ze-com.com
SMTP_PORT=587
SMTP_USER=[tonadresse@ze-com.com](mailto:tonadresse@ze-com.com)
SMTP_PASS=motdepasse_application
SMTP_FROM="Ze-Com [tonadresse@ze-com.com](mailto:tonadresse@ze-com.com)"

````

⚠️ **Important** :
- Vérifier que MySQL est bien lancé sur MAMP
- Vérifier que la base de données `gestion_tmp_travail` existe (un fichier SQL est fourni dans le projet)

---

### 4️⃣ Lancer le serveur de développement

```bash
npm run dev
````

Le projet sera accessible à l’adresse :

👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🗄️ Base de données

Un fichier SQL est fourni dans le projet :

```
gestion_tmp_travail.sql
```

Il permet d’importer :

* les tables utilisateurs
* les demandes de congés
* les heures supplémentaires
* les rôles et permissions

👉 À importer directement via **phpMyAdmin (MAMP)**.

---

## 🧠 Fonctionnement de l’application

### 👥 Gestion des rôles

L’application repose sur 3 rôles principaux :

* **Utilisateur**
* **Admin**
* **RH** (même niveau de droits que l’Admin)

---

### 🔐 Création et sécurisation des comptes

* Le **tout premier utilisateur** peut être créé **sans admin existant** (initialisation de l’application)
* Les **admins / RH** peuvent ensuite créer de nouveaux utilisateurs
* Les admins **n’ont jamais accès aux mots de passe**

👉 Lorsqu’un utilisateur est créé par un admin :

* un **email automatique** est envoyé
* il contient un **token sécurisé**
* ce token permet à l’utilisateur de **définir lui-même son mot de passe**

Aucun mot de passe n’est transmis ni stocké en clair.

---

### 🗓️ Gestion des congés

* Les utilisateurs peuvent :

  * faire des **demandes de congés**
  * consulter leurs propres demandes

* Les admins / RH peuvent :

  * voir l’ensemble des demandes
  * **valider ou refuser** une demande
  * consulter les calendriers d’équipe

👉 Les utilisateurs **n’ont pas accès** :

* aux informations sensibles des autres salariés
* aux détails privés des demandes des autres utilisateurs

---

### ⏱️ Gestion des heures supplémentaires

* Les utilisateurs peuvent :

  * déclarer des heures supplémentaires
  * demander des heures de récupération

* Les admins / RH peuvent :

  * ajuster les soldes
  * valider ou refuser les demandes
  * corriger manuellement les heures si nécessaire

---

### 📊 Gestion des utilisateurs (Admin / RH)

Les admins et RH peuvent :

* créer / modifier / supprimer des utilisateurs
* gérer :

  * soldes de congés
  * soldes d’heures supplémentaires
  * rôles
  * informations personnelles

---

## 🛠️ Stack technique

* **Next.js** (App Router)
* **TypeScript**
* **Tailwind CSS**
* **MySQL**
* **SMTP** pour l’envoi des emails
* Architecture API Routes sécurisée

---

## ✅ Objectifs du projet

* Centraliser la gestion des congés et heures supplémentaires
* Sécuriser les accès et les données sensibles
* Simplifier l’onboarding des utilisateurs
* Offrir une interface claire et responsive
* Respecter les contraintes métier d’une entreprise

---

## 👤 Auteur

Projet développé dans un contexte professionnel / pédagogique pour la gestion interne d’une entreprise.
