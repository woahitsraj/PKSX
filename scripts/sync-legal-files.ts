import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const legalOutput = path.join(repoRoot, 'static/legal');
const repositoryUrl = 'https://github.com/woahitsraj/pksx';

const pkhexVersion = await readPkhexVersion();
const pkhexRelease = pkhexVersion
	.split('.')
	.map((part, index) => (index === 0 ? part : part.padStart(2, '0')))
	.join('.');
const sourceRevision = readSourceRevision();
const sourceUrl = sourceRevision ? `${repositoryUrl}/tree/${sourceRevision}` : repositoryUrl;

await mkdir(legalOutput, { recursive: true });
await Promise.all([
	copyFile(path.join(repoRoot, 'LICENSE'), path.join(legalOutput, 'LICENSE.txt')),
	copyFile(
		path.join(repoRoot, 'THIRD_PARTY_NOTICES.md'),
		path.join(legalOutput, 'THIRD_PARTY_NOTICES.md')
	),
	writeFile(
		path.join(legalOutput, 'SOURCE.txt'),
		`PKSX corresponding source

PKSX source${sourceRevision ? ` for revision ${sourceRevision}` : ''}:
${sourceUrl}

PKHeX.Core ${pkhexVersion} source:
https://github.com/kwsch/PKHeX/tree/${pkhexRelease}

Build instructions and required scripts are included in the PKSX source repository.
The PKSX license is available at /legal/LICENSE.txt.
Third-party notices are available at /legal/THIRD_PARTY_NOTICES.md.
`
	)
]);

console.log(`Synced legal files to ${path.relative(repoRoot, legalOutput)}`);

async function readPkhexVersion(): Promise<string> {
	const packages = await readFile(path.join(repoRoot, 'Directory.Packages.props'), 'utf8');
	const match = packages.match(/PackageVersion Include="PKHeX\.Core" Version="([^"]+)"/);

	if (!match?.[1]) {
		throw new Error('Unable to read the PKHeX.Core version from Directory.Packages.props.');
	}

	return match[1];
}

function readSourceRevision(): string | undefined {
	const configuredRevision = process.env.PKSX_SOURCE_REVISION ?? process.env.GITHUB_SHA;
	if (configuredRevision) {
		return configuredRevision;
	}

	const status = spawnSync('git', ['status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' });
	if (status.status !== 0 || status.stdout.trim()) {
		return undefined;
	}

	const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' });
	return result.status === 0 ? result.stdout.trim() : undefined;
}
