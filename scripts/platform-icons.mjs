import { writeFileSync } from "node:fs";
import * as icons from "../node_modules/simple-icons/index.mjs";
const names = {
  YouTube: "siYoutube",
  TikTok: "siTiktok",
  Instagram: "siInstagram",
  "X / Twitter": "siX",
  SoundCloud: "siSoundcloud",
  Pinterest: "siPinterest",
  Vimeo: "siVimeo",
  Dailymotion: "siDailymotion",
  Twitch: "siTwitch",
  Reddit: "siReddit",
  Facebook: "siFacebook",
  Bilibili: "siBilibili",
  "Archive.org": "siInternetarchive",
  Wikimedia: "siWikimediafoundation",
};
const paths = Object.fromEntries(
  Object.entries(names).map(([name, key]) => [name, icons[key].path]),
);
writeFileSync(
  new URL("../public/platform-icons.js", import.meta.url),
  `// Brand paths from Simple Icons (CC0). https://simpleicons.org\nexport const platformPaths=${JSON.stringify(paths, null, 2)};\n`,
);
