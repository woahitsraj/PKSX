import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
	appId: 'com.pksx.app',
	appName: 'PKSX',
	webDir: 'build',
	zoomEnabled: false,
	experimental: {
		ios: {
			spm: {
				swiftToolsVersion: '6.2'
			}
		}
	}
};

export default config;
