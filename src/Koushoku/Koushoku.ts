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
    ContentRating,
    LanguageCode,
    Request,
    Response
} from "paperback-extensions-common"

import {Parser} from "./KoushokuParser";
const Koushoku_Base = "https://koushoku.org"

export const KoushokuInfo: SourceInfo = {
    author: 'xOnlyFadi',
    description: 'Extension that pulls manga from Koushoku',
    icon: 'icon.png',
    name: 'Koushoku',
    version: '1.0.2',
    authorWebsite: 'https://github.com/xOnlyFadi',
    websiteBaseURL: Koushoku_Base,
    contentRating: ContentRating.ADULT,
    language: LanguageCode.ENGLISH,
    sourceTags: [
        {
            text: "18+",
            type: TagType.YELLOW
        },
    ]
}

export abstract class Koushoku extends Source {
    private readonly parser: Parser = new Parser();

    thumbnailSelector: string = ".thumbnail img"
    magazinesSelector: string = ".metadata .magazines a"
    readonly requestManager = createRequestManager({
        requestsPerSecond: 3,
        requestTimeout: 30000,
        interceptor: {
            interceptRequest: async (request: Request): Promise<Request> => {

                request.headers = {
                    ...(request.headers ?? {}),
                    ...{
                        'referer': `${Koushoku_Base}/`,
                    }
                }

                return request
            },

            interceptResponse: async (response: Response): Promise<Response> => {
                return response
            }
        }
    })

    override async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const options = createRequestObject({
            url: `${Koushoku_Base}`,
            method: 'GET'
        });
        let response = await this.requestManager.schedule(options, 1);
        let $ = this.cheerio.load(response.data);
        return this.parser.parseHomeSections($, sectionCallback, this)
    }

    override async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        let page = metadata?.page ?? 1
        if (page == -1) return createPagedResults({ results: [], metadata: { page: -1 } })
        let param = ''
        switch (homepageSectionId) {
            case '3':
                param = `/?page=${page}`
                break
            default:
                throw new Error(`Invalid homeSectionId | ${homepageSectionId}`)
        }
        const request = createRequestObject({
            url: `${Koushoku_Base}${param}`,
            method: 'GET',
        })

        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        const manga = this.parser.parseSearchResults($, this)

        page++
        if (!this.parser.NextPage($)) page = -1
        return createPagedResults({
            results: manga,
            metadata: { page: page }
        })
    }

    async getMangaDetails(mangaId: string): Promise<Manga> {
        const options  = createRequestObject({
            url: `${Koushoku_Base}/archive/${mangaId}`,
            method: 'GET',
        });
        let response = await this.requestManager.schedule(options, 1);
        let $ = this.cheerio.load(response.data);
        return this.parser.parseMangaDetails($, mangaId,this);
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const options = createRequestObject({
            url: `${Koushoku_Base}/archive/${mangaId}`,
            method: 'GET'
        });
        let response = await this.requestManager.schedule(options, 1);
        let $ = this.cheerio.load(response.data);
        return this.parser.parseChapters($, mangaId, this);
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const options = createRequestObject({
            url: `${Koushoku_Base}/archive/${chapterId}`,
            method: 'GET'
        });
        let response = await this.requestManager.schedule(options, 1);
        let $ = this.cheerio.load(response.data);
        return this.parser.parseChapterDetails($, mangaId, chapterId)
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        let page = metadata?.page ?? 1
        const title: string = query.title ?? ''
        if (page == -1) return createPagedResults({ results: [], metadata: { page: -1 } })
        if (/^\d+$/.test(title)) {
            const request = createRequestObject({
                url: `${Koushoku_Base}/archive/${title}`,
                method: 'GET'
            })

            const data = await this.requestManager.schedule(request, 1)
            const $ = this.cheerio.load(data.data)
            const manga = this.parser.parseSearchResultsArchive($, this,title)
            return createPagedResults({
                results: manga,
                metadata: { page: page },
            })
        } else {
        const request = createRequestObject({
            url: `${Koushoku_Base}/search?page=${page}&q=${this.normalizeSearchQuery(query.title)}`,
            method: 'GET',
        })
        const data = await this.requestManager.schedule(request, 2)
        const $ = this.cheerio.load(data.data)
        const manga = this.parser.parseSearchResults($, this)

        page++
        if (!this.parser.NextPage($)) page = -1

        return createPagedResults({
            results: manga,
            metadata: { page: page },
        })
    }
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
}