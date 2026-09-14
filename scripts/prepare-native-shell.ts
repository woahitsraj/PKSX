import { copyFile } from 'node:fs/promises';
import path from 'node:path';

const destinations: Record<string, string> = {
	ios: 'ios/App/App/public/index.html',
	android: 'android/app/src/main/assets/public/index.html'
};
const destination = destinations[process.env.CAPACITOR_PLATFORM_NAME ?? ''];
if (!destination) throw new Error('Unsupported Capacitor platform.');

await copyFile(path.join(process.env.CAPACITOR_WEB_DIR ?? 'build', 'native.html'), destination);
