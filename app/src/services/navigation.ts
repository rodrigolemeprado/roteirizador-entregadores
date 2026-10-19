import { Linking } from 'react-native';

export type NavApp = 'waze' | 'gmaps';

export function navigationUrl(app: NavApp, lat: number, lng: number): string {
  return app === 'waze'
    ? `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
    : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

/** Abre a parada no Waze ou Google Maps (o app instalado trata o link; senão abre o navegador). */
export async function openNavigation(app: NavApp, lat: number, lng: number): Promise<void> {
  await Linking.openURL(navigationUrl(app, lat, lng));
}
