export const API_SESSION = 'La sesión se cerró. Vuelve a entrar.';
export const API_UNAVAILABLE = 'No se pudo completar. Inténtalo de nuevo.';
export const API_AGENT = 'El tutor no respondió. Inténtalo de nuevo.';
export const API_FORBIDDEN = 'No tienes acceso a este recurso.';
export const API_VALIDATION = 'Revisa los datos e inténtalo de nuevo.';

export function toApiError(status: number, fallback = API_UNAVAILABLE): string {
	if (status === 401) {
		return API_SESSION;
	}
	if (status === 403) {
		return API_FORBIDDEN;
	}
	if (status === 422) {
		return API_VALIDATION;
	}
	if (status >= 500) {
		return API_AGENT;
	}
	return fallback;
}
