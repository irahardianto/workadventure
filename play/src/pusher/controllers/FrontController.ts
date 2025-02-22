import type { Request, Response, Server } from "hyper-express";
import fs from "fs";
import { BaseHttpController } from "./BaseHttpController";
import { FRONT_ENVIRONMENT_VARIABLES, VITE_URL } from "../enums/EnvironmentVariable";
import { MetaTagsBuilder } from "../services/MetaTagsBuilder";
import Mustache from "mustache";
import type { LiveDirectory } from "../models/LiveDirectory";

export class FrontController extends BaseHttpController {
    private indexFile: string;
    private script: string;

    constructor(protected app: Server, protected liveAssets: LiveDirectory) {
        super(app);

        let indexPath: string;
        if (fs.existsSync("dist/public/index.html")) {
            // In prod mode
            indexPath = "dist/public/index.html";
        } else if (fs.existsSync("index.html")) {
            // In dev mode
            indexPath = "index.html";
        } else {
            throw new Error("Could not find index.html file");
        }

        this.indexFile = fs.readFileSync(indexPath, "utf8");

        // Pre-parse the index file for speed (and validation)
        Mustache.parse(this.indexFile);

        this.script = "window.env = " + JSON.stringify(FRONT_ENVIRONMENT_VARIABLES);
    }

    routes(): void {
        this.front();
    }

    private getFullUrl(req: Request): string {
        let protocol = req.header("X-Forwarded-Proto");
        if (!protocol) {
            protocol = req.protocol;
        }
        return `${protocol}://${req.get("host")}${req.originalUrl}`;
    }

    front(): void {
        this.app.get("/_/*", (req: Request, res: Response) => {
            /**
             * get infos from map file details
             */
            return this.displayFront(req, res, this.getFullUrl(req));
        });

        this.app.get("/*/*", (req: Request, res: Response) => {
            /**
             * get infos from map file details
             */
            return this.displayFront(req, res, this.getFullUrl(req));
        });

        this.app.get("/@/*", (req: Request, res: Response) => {
            /**
             * get infos from admin else map file details
             */
            return this.displayFront(req, res, this.getFullUrl(req));
        });

        this.app.get("/~/*", (req: Request, res: Response) => {
            /**
             * get infos from map file details
             */
            return this.displayFront(req, res, this.getFullUrl(req));
        });

        this.app.get("/", (req: Request, res: Response) => {
            return this.displayFront(req, res, this.getFullUrl(req));
        });

        this.app.get("/index.html", (req: Request, res: Response) => {
            res.status(303).redirect("/");
            return;
        });

        this.app.get("/static/images/favicons/manifest.json", (req: Request, res: Response) => {
            if (req.query.url == undefined) {
                return res.status(500).send("playUrl is empty in query pramater of the request");
            }
            return this.displayManifestJson(req, res, req.query.url.toString());
        });

        this.app.get("/login", (req: Request, res: Response) => {
            return this.displayFront(req, res, this.getFullUrl(req));
        });

        // @deprecated
        this.app.get("/jwt", (req: Request, res: Response) => {
            return this.displayFront(req, res, this.getFullUrl(req));
        });

        // @deprecated
        this.app.get("/register", (req: Request, res: Response) => {
            return this.displayFront(req, res, this.getFullUrl(req));
        });

        // this.app.get("/static/images/favicons/manifest.json", (req: Request, res: Response) => {
        //     return res.status(303).redirect("/");
        // });

        this.app.get("/*", (req: Request, res: Response) => {
            if (req.path.startsWith("/src") || req.path.startsWith("/node_modules") || req.path.startsWith("/@fs/")) {
                res.status(303).redirect(`${VITE_URL}${decodeURI(req.path)}`);
                return;
            }

            const filePath = req.path.startsWith("/src") ? req.path.replace(/\/src/, "") : req.path;

            const file = this.liveAssets.get(decodeURI(filePath));

            if (!file) {
                res.status(404).send("404 Page not found");
                return;
            }

            if (filePath.startsWith("/assets")) {
                const date = new Date();
                date.setFullYear(date.getFullYear() + 1);
                res.header("expires", date.toUTCString());
                res.header("cache-control", "public");
            }
            if (filePath.startsWith("/resources") || filePath.startsWith("/static")) {
                const date = new Date();
                date.setDate(date.getDate() + 1);
                res.header("expires", date.toUTCString());
                res.header("cache-control", "public");
            }

            res.type(file.extension).header("etag", file.etag).send(file.buffer);
            return;
        });
    }

    private async displayFront(req: Request, res: Response, url: string) {
        const builder = new MetaTagsBuilder(url);
        let html = this.indexFile;

        let redirectUrl: string | undefined;

        try {
            redirectUrl = await builder.getRedirectUrl();
        } catch (e) {
            console.log(`Cannot get redirect URL ${url}`, e);
        }

        if (redirectUrl) {
            return res.redirect(redirectUrl);
        }

        try {
            const metaTagsData = await builder.getMeta(req.header("User-Agent"));
            html = Mustache.render(this.indexFile, {
                ...metaTagsData,
                msApplicationTileImage: metaTagsData.favIcons[metaTagsData.favIcons.length - 1].src,
                url,
                script: this.script,
            });
        } catch (e) {
            console.log(`Cannot render metatags on ${url}`, e);
        }

        return res.type("html").send(html);
    }

    private async displayManifestJson(req: Request, res: Response, url: string) {
        const builder = new MetaTagsBuilder(url);

        const metaTagsData = await builder.getMeta(req.header("User-Agent"));

        const manifest = {
            short_name: metaTagsData.title,
            name: metaTagsData.title,
            icons: metaTagsData.manifestIcons,
            start_url: "/",
            background_color: metaTagsData.themeColor,
            display_override: ["window-control-overlay", "minimal-ui"],
            display: "standalone",
            orientation: "portrait-primary",
            scope: "/",
            lang: "en",
            theme_color: metaTagsData.themeColor,
            shortcuts: [
                {
                    name: metaTagsData.title,
                    short_name: metaTagsData.title,
                    description: metaTagsData.description,
                    url: "/",
                    icons: [
                        {
                            src: "/static/images/favicons/android-icon-192x192.png",
                            sizes: "192x192",
                            type: "image/png",
                        },
                    ],
                },
            ],
            description: metaTagsData.description,
            screenshots: [],
            related_applications: [
                {
                    platform: "web",
                    url: "https://workadventu.re",
                },
                {
                    platform: "play",
                    url: "https://play.workadventu.re",
                },
            ],
        };

        return res.json(manifest);
    }
}
