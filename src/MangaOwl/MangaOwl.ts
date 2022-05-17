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
    Request,
    Response
} from "paperback-extensions-common"

import {Parser} from "./MangaOwlParser";
import { URLBuilder } from './helper'
const MangaOwl_Base = "https://www.mangaowls.com"

export const MangaOwlInfo: SourceInfo = {
    author: 'xOnlyFadi',
    description: 'Extension that pulls manga from MangaOwls',
    icon: 'icon.png',
    name: 'MangaOwls',
    version: '3.0.4',
    authorWebsite: 'https://github.com/xOnlyFadi',
    websiteBaseURL: MangaOwl_Base,
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

    readonly requestManager = createRequestManager({
        requestsPerSecond: 3,
        requestTimeout: 30000,
        interceptor: {
            interceptRequest: async (request: Request): Promise<Request> => {

                request.headers = {
                    ...(request.headers ?? {}),
                    ...{
                        'referer': `${MangaOwl_Base}/`,
                        'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.4 Mobile/15E148 Safari/604.1'
                    }
                }

                return request
            },

            interceptResponse: async (response: Response): Promise<Response> => {
                return response
            }
        }
    })

    override getMangaShareUrl(mangaId: string): string {
        return `${MangaOwl_Base}/single/${mangaId}`
    }

    override getCloudflareBypassRequest() {
            return createRequestObject({
            url: `${MangaOwl_Base}/single/48021`,
            method: "GET",
            headers: {
                'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.4 Mobile/15E148 Safari/604.1'
            }
        });
    }

    override async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const options = createRequestObject({
            url: `${MangaOwl_Base}`,
            method: 'GET'
        });
        let response = await this.requestManager.schedule(options, 1);
        this.CloudFlareError(response.status)
        let $ = this.cheerio.load(response.data);
        return this.parser.parseHomeSections($, sectionCallback, this)
    }

    override async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        let page = metadata?.page ?? 1
        if (page == -1) return createPagedResults({ results: [], metadata: { page: -1 } })
        let param = ''
        switch (homepageSectionId) {
            case '2':
                param = `/new_release/${page}`
                break
            case '3':
                param = `/lastest/${page}`
                break
            case '4':
                param = `/popular/${page}`
                break
            default:
                throw new Error(`Invalid homeSectionId | ${homepageSectionId}`)
        }
        const request = createRequestObject({
            url: `${MangaOwl_Base}${param}`,
            method: 'GET',
        })

        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        const manga = this.parser.parseSearchResults($, this)

        page++
        if (manga.length < 36) page = -1
        return createPagedResults({
            results: manga,
            metadata: { page: page }
        })
    }

    override async getTags(): Promise<TagSection[]> {
        const options = createRequestObject({
            url: `${MangaOwl_Base}/search/1?search=`,
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
            url: `${MangaOwl_Base}/single/${mangaId}`,
            method: 'GET',
        });
        let response = await this.requestManager.schedule(options, 1);
        this.CloudFlareError(response.status)
        let $ = this.cheerio.load(response.data);
        return this.parser.parseMangaDetails($, mangaId,this);
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const options = createRequestObject({
            url: `${MangaOwl_Base}/single/${mangaId}`,
            method: 'GET'
        });
        let response = await this.requestManager.schedule(options, 1);
        this.CloudFlareError(response.status)
        let $ = this.cheerio.load(response.data);
        return this.parser.parseChapters($, mangaId, this);
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const options = createRequestObject({
            url: `${MangaOwl_Base}${chapterId}`,
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
        if (manga.length < 36) page = -1

        return createPagedResults({
            results: manga,
            metadata: { page: page },
        })
    }

    constructSearchRequest(page: number, query: SearchRequest): any {
        return createRequestObject({
            url: new URLBuilder(MangaOwl_Base)
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
        query = query.replace(/ /g,"+");
        query = query.replace(/%20/g, "+");
        return query;
        
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
            mangaUpdatesFoundCallback(createMangaUpdates({
                ids: actualIds
            }))
            }
            const options = createRequestObject({
                url: `${MangaOwl_Base}/lastest/${page}`,
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
            throw new Error('CLOUDFLARE BYPASS ERROR:\nPlease go to Settings > Sources > MangaOwls and press Cloudflare Bypass or press the Cloud image on the right')
        }
    }
}