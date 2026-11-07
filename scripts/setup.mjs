// Downloads tools into this project only. Existing system tools are not modified.
import { mkdir, writeFile, readFile, readdir, copyFile, chmod } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = path.join(root,'bin');
await mkdir(bin,{recursive:true});
async function fetchOk(url) {
  const r=await fetch(url,{headers:{'User-Agent':'Flux-Media-Setup','Accept':'application/vnd.github+json'},signal:AbortSignal.timeout(180000)});
  if(!r.ok)throw new Error(`Download failed (${r.status}): ${url}`);return r;
}
async function installAsset(repo,name) {
  const release=await (await fetchOk(`https://api.github.com/repos/${repo}/releases/latest`)).json();
  const asset=release.assets.find(a=>a.name===name);if(!asset)throw new Error(`Could not find ${name} in the current release.`);
  console.log(`Downloading ${name} from ${repo} ${release.tag_name}…`);
  const bytes=Buffer.from(await (await fetchOk(asset.browser_download_url)).arrayBuffer());
  let expected=asset.digest?.replace(/^sha256:/,'');
  if(!expected || !/^[a-f0-9]{64}$/i.test(expected)) {
    const sums=release.assets.find(a=>/^(SHA2-256SUMS|sha256sums\.txt)$/i.test(a.name));
    if(!sums)throw new Error(`No SHA-256 checksum was supplied for ${name}; installation stopped.`);
    const lines=(await (await fetchOk(sums.browser_download_url)).text()).split(/\r?\n/);
    expected=lines.find(l=>l.trim().endsWith(name))?.trim().split(/\s+/)[0];
  }
  if(!expected || createHash('sha256').update(bytes).digest('hex')!==expected.toLowerCase())throw new Error(`Checksum verification failed for ${name}.`);
  const target=path.join(bin,name);await writeFile(target,bytes);console.log(`Verified ${name}`);return target;
}
async function findFile(dir,name) {
  for(const e of await readdir(dir,{withFileTypes:true})) {const p=path.join(dir,e.name);if(e.isFile()&&e.name===name)return p;if(e.isDirectory()){const found=await findFile(p,name);if(found)return found;}}
}
try {
  if(process.platform==='win32') {
    const name=process.arch==='arm64'?'yt-dlp_arm64.exe':'yt-dlp.exe';const downloaded=await installAsset('yt-dlp/yt-dlp',name);if(name!=='yt-dlp.exe')await copyFile(downloaded,path.join(bin,'yt-dlp.exe'));
    // BtbN's current Windows builds target x64. ARM64 machines can use a native FFMPEG_PATH instead.
    if(process.arch!=='x64')throw new Error('yt-dlp installed. Install native FFmpeg and set FFMPEG_PATH for this architecture.');
    const archive=await installAsset('BtbN/FFmpeg-Builds','ffmpeg-master-latest-win64-gpl.zip');
    const extract=path.join(bin,'ffmpeg-extracted');
    const quote=s=>"'"+s.replaceAll("'","''")+"'";
    const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`Expand-Archive -LiteralPath ${quote(archive)} -DestinationPath ${quote(extract)} -Force`],{stdio:'inherit',windowsHide:true});
    if(result.status!==0)throw new Error('Could not extract FFmpeg.');
    for(const name of ['ffmpeg.exe','ffprobe.exe']){const found=await findFile(extract,name);if(!found)throw new Error(`${name} not found in archive`);await copyFile(found,path.join(bin,name));}
  } else {
    const name=process.platform==='darwin'?'yt-dlp_macos':process.arch==='arm64'?'yt-dlp_linux_aarch64':'yt-dlp_linux';
    const downloaded=await installAsset('yt-dlp/yt-dlp',name);await copyFile(downloaded,path.join(bin,'yt-dlp'));await chmod(path.join(bin,'yt-dlp'),0o755);
    const check=spawnSync('ffmpeg',['-version'],{stdio:'ignore'});if(check.status!==0)throw new Error('yt-dlp installed. Install FFmpeg with your system package manager, then restart Flux.');
  }
  console.log('\nReady! Run npm start and open http://localhost:3000');
} catch(e) {console.error('\nSetup could not finish:',e.message);console.error('Check your internet connection and retry npm run setup. You can also set YTDLP_PATH and FFMPEG_PATH to existing installations.');process.exitCode=1;}
