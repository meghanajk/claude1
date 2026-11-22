import { Config } from "@remotion/cli/config";

// Processed media (from `npm run media`) is served as the public dir.
Config.setPublicDir("./media_processed");
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setConcurrency(4);
