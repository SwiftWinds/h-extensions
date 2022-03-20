import {
    PagedResults,
    Source,
    Manga,
    Chapter,
    ChapterDetails,
    HomeSection,
    SearchRequest,
    SourceInfo,
    TagType,
    MangaStatus,
    ContentRating,
    TagSection,
    LanguageCode,
    MangaUpdates,
} from "paperback-extensions-common"

import {Parser} from "./MangaOwlParser";
import { URLBuilder } from './helper'
const MangaOwlBase = "https://www.mangaowls.com"

export const MangaOwlInfo: SourceInfo = {
    author: 'xOnlyFadi',
    description: 'Extension that pulls manga from MangaOwls',
    icon: 'icon.png',
    name: 'MangaOwls',
    version: '2.4.4',
    authorWebsite: 'https://github.com/nar1n',
    websiteBaseURL: MangaOwlBase,
    contentRating: ContentRating.ADULT,
    language: LanguageCode.ENGLISH,
    sourceTags: [
        {
            text: "Notifications",
            type: TagType.GREEN
        },
        {
            text: "18+",
            type: TagType.YELLOW
        },
        {
            text: "Cloudflare",
            type: TagType.RED
        }
    ]
}

export abstract class MangaOwl extends Source {
    private readonly parser: Parser = new Parser();

    chapterDetailsSelector: string = "div.item img.owl-lazy"
    
    decodeHTMLEntity(str: string): string {
        return str.replace(/&#(\d+);/g, function (_match, dec) {
            return String.fromCharCode(dec);
        })
    }
    readonly requestManager = createRequestManager({
        requestsPerSecond: 3,
        requestTimeout: 30000,
    })

   override getCloudflareBypassRequest() {
            return createRequestObject({
            url: `${MangaOwlBase}/single/46862`,
            method: "GET",
        });
    }

   override async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const options = createRequestObject({
            url: `${MangaOwlBase}`,
            method: 'GET'
        });
        let response = await this.requestManager.schedule(options, 1);
        this.CloudFlareError(response.status)
        let $ = this.cheerio.load(response.data);
        return this.parser.parseHomeSections($, sectionCallback, this)
    }

    override async getTags(): Promise<TagSection[]> {
        const options = createRequestObject({
            url: `${MangaOwlBase}/search/1?search=`,
            method: 'GET'
        });
        let response = await this.requestManager.schedule(options, 1);
        this.CloudFlareError(response.status)
        let $ = this.cheerio.load(response.data);
        return [createTagSection({
            id: "1",
            label: "1",
            tags: this.parser.parseTags($)
        })];
    }
    async getMangaDetails(mangaId: string): Promise<Manga> {
        const options  = createRequestObject({
            url: `${MangaOwlBase}/single/${mangaId}`,
            method: 'GET',
        });
        let response = await this.requestManager.schedule(options, 1);
        this.CloudFlareError(response.status)
        let $ = this.cheerio.load(response.data);
        return this.parser.parseMangaDetails($, mangaId,this);
    }
    async getChapters(mangaId: string): Promise<Chapter[]> {
        const options = createRequestObject({
            url: `${MangaOwlBase}/single/${mangaId}`,
            method: 'GET'
        });
        let response = await this.requestManager.schedule(options, 1);
        this.CloudFlareError(response.status)
        let $ = this.cheerio.load(response.data);
        return this.parser.parseChapters($, mangaId, this);
    }
    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const options = createRequestObject({
            url: `${MangaOwlBase}${chapterId}`,
            method: 'GET'
        });
        let response = await this.requestManager.schedule(options, 1);
        this.CloudFlareError(response.status)
        let $ = this.cheerio.load(response.data);
        return this.parser.parseChapterDetails($, mangaId, chapterId, this.chapterDetailsSelector)
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        let page = metadata?.page ?? 1
        if (page == -1) return createPagedResults({ results: [], metadata: { page: -1 } })

        const request = this.constructSearchRequest(page, query)
        const data = await this.requestManager.schedule(request, 2)
        this.CloudFlareError(data.status)
        const $ = this.cheerio.load(data.data)
        const manga = this.parser.parseSearchResults($, this)

        page++
        if (manga.length >= 36) page = -1

        return createPagedResults({
            results: manga,
            metadata: { page: page },
        })
    }

    constructSearchRequest(page: number, query: SearchRequest): any {
        return createRequestObject({
            url: new URLBuilder(MangaOwlBase)
            .addPathComponent('search')
            .addPathComponent(page.toString())
            .addQueryParameter('search', encodeURIComponent(query?.title ?? ''))
            .addQueryParameter('search_field', "12")
            .addQueryParameter('sort', '4')
            .addQueryParameter('completed', '2')
            .addQueryParameter(
                'genres',
                query?.includedTags?.map((x: any) => x.id)
            )
            .addQueryParameter('chapter_from', '0')
            .addQueryParameter('chapter_to', '')
            .buildUrl({ addTrailingSlash: false, includeUndefinedParameters: false }),
            method: 'GET',
        })
    }
    normalizeSearchQuery(query: any) {
        var query = query.toLowerCase();
        query = query.replace(/[àáạảãâầấậẩẫăằắặẳẵ]+/g, "a");
        query = query.replace(/[èéẹẻẽêềếệểễ]+/g, "e");
        query = query.replace(/[ìíịỉĩ]+/g, "i");
        query = query.replace(/[òóọỏõôồốộổỗơờớợởỡ]+/g, "o");
        query = query.replace(/[ùúụủũưừứựửữ]+/g, "u");
        query = query.replace(/[ỳýỵỷỹ]+/g, "y");
        query = query.replace(/[đ]+/g, "d");
        query = query.replace(/ /g,"%20");
        query = query.replace(/%20/g, "%20");
        return query;
        
    }
        /**
     * Parses a time string from a Madara source into a Date object.
     * Copied from Madara.ts made by gamefuzzy
     */
         protected convertTime(timeAgo: string): Date {
            let time: Date
            let trimmed = Number((/\d*/.exec(timeAgo) ?? [])[0])
            trimmed = trimmed == 0 && timeAgo.includes('a') ? 1 : trimmed
            if (timeAgo.includes('mins') || timeAgo.includes('minutes') || timeAgo.includes('minute')) {
                time = new Date(Date.now() - trimmed * 60000)
            } else if (timeAgo.includes('hours') || timeAgo.includes('hour')) {
                time = new Date(Date.now() - trimmed * 3600000)
            } else if (timeAgo.includes('days') || timeAgo.includes('day')) {
                time = new Date(Date.now() - trimmed * 86400000)
            } else if (timeAgo.includes('year') || timeAgo.includes('years')) {
                time = new Date(Date.now() - trimmed * 31556952000)
            } else {
                time = new Date(timeAgo)
            }
    
            return time
        }
    parseStatus(str: string): MangaStatus {
        let status = MangaStatus.UNKNOWN
        switch (str.toLowerCase()) {
            case 'ongoing':
                status = MangaStatus.ONGOING
                break
            case 'completed':
                status = MangaStatus.COMPLETED
                break
        }
        return status
    }
    override async filterUpdatedManga(mangaUpdatesFoundCallback: (updates: MangaUpdates) => void, time: Date, ids: string[]): Promise<void> {
        let page: number = 1;
        let idsFound: string[] | null = [];
        while (idsFound !== null && ids.length !== 0) {
            const actualIds: string[] = []
            for (let i = 0; i < idsFound.length; i++) {
                const id = idsFound[i] ?? '';
                if (ids.includes(id)){
                    actualIds.push(id)
                    ids.splice(ids.indexOf(id), 1);
                }
            }
            if (actualIds.length > 0){
                console.log(`Id is ${actualIds}`)
            mangaUpdatesFoundCallback(createMangaUpdates({
                ids: actualIds
            }))
            }
            const options = createRequestObject({
                url: `${MangaOwlBase}/lastest/${page}`,
                method: 'GET',
            });
            let response = await this.requestManager.schedule(options, 1);
            let $ = this.cheerio.load(response.data);
            idsFound = this.parser.parseTimesFromTiles($, time);
            page++;
        }
    }
    CloudFlareError(status: any) {
        if(status == 503) {
            throw new Error('CLOUDFLARE BYPASS ERROR:\nPlease go to Settings > Sources > \<\The name of this source\> and press Cloudflare Bypass')
        }
    }
}