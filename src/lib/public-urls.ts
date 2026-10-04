/** URLs públicas (site do cliente). Seguro para usar no navegador. */
export const publicPhotoUrl = (id: string, thumb = false) => `/api/public/photos/${id}${thumb ? "?s=t" : ""}`;
