// ============================================================
// ENUMS — identiques au backend C#
// ============================================================
export enum UserRole { CLIENT = 'CLIENT', REPARATEUR = 'REPARATEUR', ADMIN = 'ADMIN' }

export enum TypeAppareil {
  LAVE_LINGE = 'LAVE_LINGE', SECHE_LINGE = 'SECHE_LINGE',
  LAVE_VAISSELLE = 'LAVE_VAISSELLE', REFRIGERATEUR = 'REFRIGERATEUR',
  CONGELATEUR = 'CONGELATEUR', FOUR = 'FOUR',
  HOTTE = 'HOTTE', MICRO_ONDE = 'MICRO_ONDE', AUTRE = 'AUTRE'
}

export enum TypePanne {
  NE_DEMARRE_PLUS = 'NE_DEMARRE_PLUS', FUITE_EAU = 'FUITE_EAU',
  BRUIT_ANORMAL = 'BRUIT_ANORMAL', CODE_ERREUR = 'CODE_ERREUR',
  NE_CHAUFFE_PLUS = 'NE_CHAUFFE_PLUS', AUTRE = 'AUTRE'
}

export enum TypeIntervention { DOMICILE = 'DOMICILE', ATELIER = 'ATELIER', INDIFFERENT = 'INDIFFERENT' }
export enum StatutDemande { OUVERTE = 'OUVERTE', EN_PAUSE = 'EN_PAUSE', TRAITEE = 'TRAITEE', ANNULEE = 'ANNULEE' }
export enum StatutMatching {
  NOUVEAU = 'NOUVEAU', VU = 'VU', DEVIS_ENVOYE = 'DEVIS_ENVOYE',
  ACCEPTE = 'ACCEPTE', CLOTURE = 'CLOTURE', REFUSE = 'REFUSE', ANNULE = 'ANNULE', EXPIRE = 'EXPIRE'
}
export enum TypeMessage { TEXTE = 'TEXTE', PHOTO = 'PHOTO', DEVIS = 'DEVIS', SYSTEME = 'SYSTEME', REFUS = 'REFUS', COORDONNEES = 'COORDONNEES' }

// ============================================================
// GENERIC API WRAPPER — correspond à ApiResponse<T> du backend
// ============================================================
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ============================================================
// AUTH — POST /api/auth/register et /api/auth/login
// ============================================================

/** POST /api/auth/register */
export interface RegisterRequest {
  email: string;
  password: string;
  prenom: string;
  nom: string;
  telephone?: string;
  role: UserRole;
}

/** POST /api/auth/login */
export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  userId: string;
  email: string;
  prenom: string;
  nom: string;
  role: UserRole;
  avatarUrl?: string;
}

/** Réponse auth (token + user info) — kept for backward compat */
export interface UserDto {
  id: string;
  email: string;
  prenom: string;
  nom: string;
  telephone?: string;
  role: UserRole;
  avatarUrl?: string;
  lastLoginAt?: string;
  createdAt?: string;
}

export interface UpdateProfileRequest {
  prenom: string;
  nom: string;
  telephone?: string;
  newPassword?: string;
  currentPassword?: string;  // requis si newPassword est renseigné
}

export interface UpdateReparateurProfileRequest {
  bio?: string;
  anneesExperience: number;
  adresseAtelier?: string;
  ville: string;
  codePostal?: string;
  latitude?: number;
  longitude?: number;
  rayonInterventionKm: number;
  specialites: TypeAppareil[];
}

// ============================================================
// REPARATEUR — GET /api/reparateurs/search + /api/reparateurs/{id}
// ============================================================
export interface ReparateurPublicDto {
  id: string;
  userId: string;
  nomAffiche: string;
  bio?: string;
  anneesExperience: number;
  ville: string;
  codePostal?: string;
  latitude?: number;
  longitude?: number;
  noteMoyenne: number;
  nbAvis: number;
  nbReparations: number;
  estDisponible: boolean;
  isFounder: boolean;
  founderNumber?: number;
  specialites: string[];
  distanceKm?: number;
}

export interface AvisPublicDto {
  clientNom: string;
  note: number;
  commentaire?: string;
  appareilRepare: string;
  createdAt: string;
}

export interface ReparateurDetailDto extends ReparateurPublicDto {
  derniersAvis: AvisPublicDto[];
}

/** POST /api/reparateurs/profile */
export interface CreateReparateurRequest {
  siret: string;
  // optional
  numeroQualirepar?: string;
  bio?: string;
  anneesExperience: number;
  adresseAtelier?: string;
  ville: string;
  codePostal?: string;
  latitude?: number;
  longitude?: number;
  rayonInterventionKm: number;
  specialites: TypeAppareil[];
}

// ============================================================
// DEMANDE — /api/demandes
// ============================================================
export interface CreateDemandeRequest {
  typeAppareil: TypeAppareil;
  marque?: string;
  modele?: string;
  typePanne?: TypePanne;
  description?: string;
  photoUrls?: string[];
  adresse?: string;
  ville?: string;
  codePostal?: string;
  latitude?: number;
  longitude?: number;
  typeIntervention: TypeIntervention;
}

export interface UpdateDemandeRequest {
  typeAppareil: TypeAppareil;
  marque?: string;
  modele?: string;
  typePanne?: TypePanne;
  description?: string;
  photoUrls?: string[];
}

export interface DemandeDto {
  id: string;
  typeAppareil: TypeAppareil;
  marque?: string;
  modele?: string;
  typePanne?: TypePanne;
  description?: string;
  photoUrls: string[];
  adresse?: string;
  ville: string;
  codePostal?: string;
  typeIntervention: TypeIntervention;
  statut: StatutDemande;
  nbMatchings: number;
  nbDevisRecus: number;
  createdAt: string;
}

// ============================================================
// MATCHING — /api/matchings
// ============================================================
export interface CreateMatchingRequest {
  demandeId: string;
  reparateurId: string;
  messageInitial?: string;
}

export interface MatchingDto {
  id: string;
  demandeId: string;
  reparateurId: string;
  reparateurNom: string;
  demandeAppareil: string;
  statut: StatutMatching;
  devisMontantClient?: number;
  devisMontantBonus?: number;
  createdAt: string;
  updatedAt: string;
  nbMessages: number;
  hasUnreadMessages: boolean;
  awaitingClientConfirm: boolean;
  confirmedByClient: boolean;
}

export interface SendDevisRequest {
  lignes: { libelle: string; montant: number }[];
  montantBonus: number;
  validiteJours: number;
  messageAccompagnateur?: string;
}

// ============================================================
// MESSAGE — /api/messages/matching/{matchingId}
// ============================================================
export interface SendMessageRequest {
  contenu?: string;
  photoUrl?: string;
  type?: TypeMessage;
}

export interface MessageDto {
  id: string;
  matchingId: string;
  senderId: string;
  senderNom: string;
  senderIsReparateur: boolean;
  type: TypeMessage;
  contenu?: string;
  photoUrl?: string;
  devisData?: string;
  isRead: boolean;
  createdAt: string;
}

// ============================================================
// PAGINATION
// ============================================================
export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================================
// ADMIN
// ============================================================
export interface AdminDemandeDto {
  id: string;
  clientNom: string;
  clientEmail: string;
  typeAppareil: string;
  marque?: string;
  description?: string;
  ville: string;
  codePostal?: string;
  statut: StatutDemande;
  nbMatchings: number;
  createdAt: string;
}

export interface AdminReparateurDispoDto {
  id: string;
  nomAffiche: string;
  email: string;
  ville: string;
  codePostal?: string;
  specialites: string[];
  noteMoyenne: number;
  nbReparations: number;
}

export interface AffecterMatchingsRequest {
  reparateurIds: string[];
  messageAdmin?: string;
}

// ============================================================
// APPAREIL LABELS (UI helpers)
// ============================================================
export const APPAREIL_LABELS: Record<TypeAppareil, { label: string; icon: string; bonus: number }> = {
  [TypeAppareil.LAVE_LINGE]:    { label: 'Lave-linge',    icon: '🧺', bonus: 50 },
  [TypeAppareil.SECHE_LINGE]:   { label: 'Sèche-linge',   icon: '🌀', bonus: 45 },
  [TypeAppareil.LAVE_VAISSELLE]:{ label: 'Lave-vaisselle',icon: '🍽', bonus: 50 },
  [TypeAppareil.REFRIGERATEUR]: { label: 'Réfrigérateur', icon: '❄️', bonus: 50 },
  [TypeAppareil.CONGELATEUR]:   { label: 'Congélateur',   icon: '🧊', bonus: 45 },
  [TypeAppareil.FOUR]:          { label: 'Four',          icon: '🍳', bonus: 45 },
  [TypeAppareil.HOTTE]:         { label: 'Hotte',         icon: '🌬️', bonus: 25 },
  [TypeAppareil.MICRO_ONDE]:    { label: 'Micro-onde',    icon: '📡', bonus: 25 },
  [TypeAppareil.AUTRE]:         { label: 'Autre',         icon: '🌡', bonus: 25 },
};
