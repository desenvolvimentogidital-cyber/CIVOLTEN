/* CIVOLTEN: manter login Neon Auth existente sem reativar telas legadas. */
import {createAuthClient} from '@neon/auth';
const authUrl=__CIVOLTEN_NEON_AUTH_URL__;
const browserTest=__CIVOLTEN_BROWSER_TEST_MODE__&&
 ['localhost','127.0.0.1'].includes(location.hostname);
const auth=authUrl&&!browserTest?createAuthClient(authUrl):null;
if(!window.CIVOLTENAuthScreen)throw Error('Tela de login indisponível');
window.CIVOLTENAuthScreen.mount({
 auth,
 // Preservar associação da identidade a este navegador. Não apagar vínculos.
 ownerKey:'civolten_cloud_device_owner_v1',
 // Mostrar na primeira vinculação que os registros legados ainda existem.
 storageKey:'civolten_daily_v2',
 devFallback:browserTest
});
