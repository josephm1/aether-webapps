import type { MetadataRoute } from "next";
export default function manifest():MetadataRoute.Manifest{
 return{name:"LearnHarness",short_name:"LearnHarness",description:"Local learning workspace powered by Codex",start_url:"/?lh_local=1",scope:"/",display:"standalone",background_color:"#101012",theme_color:"#101012",icons:[{src:"/learnharness-icon.png",sizes:"512x512",type:"image/png"}]};
}
