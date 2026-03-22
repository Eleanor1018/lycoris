export type ApiResponse<T> = {
  code?: number;
  message?: string;
  data?: T;
};

export type Me = {
  publicId: string;
  username: string;
  nickname?: string;
  email: string;
  avatarUrl?: string;
  pronouns?: string;
  signature?: string;
};
