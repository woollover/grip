import { execSync } from 'child_process';
import path from 'path';
import { version as currentVersion } from '../../../package.json';

const GITHUB_REPO = 'woollover/grip';
const API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

export interface UpdateInfo {
  latest: string;
  downloadUrl: string;
  releaseUrl: string;
}

export interface UpdateResult {
  previousVersion: string;
  newVersion: string;
  installDir: string;
}

/** Fetch latest release info. Returns null if already up to date. */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  const asset = `grip-linux-${arch}.tar.gz`;

  const res = await fetch(API_URL, {
    headers: { 'User-Agent': 'grip-self-update' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`GitHub API responded ${res.status}`);

  const release = await res.json() as {
    tag_name: string;
    html_url: string;
    assets: { name: string; browser_download_url: string }[];
  };

  const latest = release.tag_name.replace(/^v/, '');
  if (latest === currentVersion) return null;

  const assetInfo = release.assets.find(a => a.name === asset);
  if (!assetInfo) throw new Error(`No release asset found for ${asset}`);

  return { latest, downloadUrl: assetInfo.browser_download_url, releaseUrl: release.html_url };
}

/**
 * Download and install the latest release over the current binary.
 * Assumes the caller has already confirmed an update is available.
 */
export async function runUpdate(info: UpdateInfo): Promise<UpdateResult> {
  const installDir = path.dirname(process.execPath);
  const tmpTar = '/tmp/grip-update.tar.gz';
  const tmpDir = '/tmp/grip-update';

  const dlRes = await fetch(info.downloadUrl, { signal: AbortSignal.timeout(120_000) });
  if (!dlRes.ok) throw new Error(`Download failed: ${dlRes.status}`);
  await Bun.write(tmpTar, dlRes);

  execSync(`rm -rf ${tmpDir} && mkdir -p ${tmpDir}`);
  execSync(`tar -xzf ${tmpTar} -C ${tmpDir}`);
  execSync(`chmod +x ${tmpDir}/grip`);
  execSync(`mv ${tmpDir}/grip ${installDir}/grip`);
  execSync(`cp -r ${tmpDir}/public ${installDir}/`);
  execSync(`rm -rf ${tmpDir} ${tmpTar}`);

  return { previousVersion: currentVersion, newVersion: info.latest, installDir };
}

export async function updateCommand(_args: string[]): Promise<void> {
  const binaryName = path.basename(process.execPath);
  if (binaryName !== 'grip') {
    console.error('\nSelf-update is only available when running as a compiled binary.');
    console.error('In dev mode, use: git pull && bun install\n');
    process.exit(1);
  }

  console.log('\nChecking for updates…\n');

  let info: UpdateInfo | null;
  try {
    info = await checkForUpdate();
  } catch (err) {
    console.error(`Could not reach GitHub: ${err instanceof Error ? err.message : err}\n`);
    process.exit(1);
  }

  if (!info) {
    console.log(`  v${currentVersion} — already up to date.\n`);
    return;
  }

  console.log(`  Current:  v${currentVersion}`);
  console.log(`  Latest:   v${info.latest}`);
  console.log(`  Changelog: ${info.releaseUrl}\n`);
  console.log('Downloading…\n');

  try {
    const result = await runUpdate(info);
    console.log(`  ✓  Binary replaced`);
    console.log(`  ✓  Static files updated`);
    console.log(`\nUpdate complete (v${result.previousVersion} → v${result.newVersion}).`);
    console.log('Restart to apply:\n');
    console.log('  systemctl restart grip\n');
  } catch (err) {
    console.error(`Update failed: ${err instanceof Error ? err.message : err}\n`);
    process.exit(1);
  }
}
