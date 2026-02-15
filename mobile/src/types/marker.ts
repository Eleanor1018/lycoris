export type MarkerCategory =
  | 'accessible_toilet'
  | 'friendly_clinic'
  | 'conversion_therapy'
  | 'self_definition';

export type MapMarker = {
  id: number;
  lat: number;
  lng: number;
  category: MarkerCategory;
  title: string;
  description?: string;
  isPublic: boolean;
  isActive: boolean;
  openTimeStart?: string | null;
  openTimeEnd?: string | null;
  markImage?: string | null;
  username?: string;
  userPublicId?: string | null;
};
