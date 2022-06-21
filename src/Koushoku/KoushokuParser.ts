import {Chapter,     
    ChapterDetails,
    HomeSection,
    LanguageCode, 
    Manga, 
    MangaTile, 
    Tag,
    TagSection,
    MangaStatus} from 'paperback-extensions-common'
import {parse} from 'url'
export class Parser {

    decodeHTMLEntity(str: string): string {
        return str.replace(/&#(\d+)/g, (_match, dec) => {
            return String.fromCharCode(dec)
        })
    }

    async parseHomeSections($: CheerioStatic,sectionCallback: (section: HomeSection) => void, source: any): Promise<void> {
        const section1 = createHomeSection({ id: '1', title: 'Weekly Trending', view_more: false})
        const section2 = createHomeSection({ id: '2', title: 'Monthly Trending', view_more: false})
        const section3 = createHomeSection({ id: '3', title: 'Latest', view_more: true})

        const weekly : MangaTile[] = []
        const hot     : MangaTile[] = []
        const monhtly  : MangaTile[] = []

        const arrWeekly = $('#trendings.feed #weekly-trending .entries > .entry').toArray()
        const arrMonthly = $('#trendings.feed #monthly-trending .entries > .entry').toArray()
        const arrLatest = $('#archives.feed .entries > .entry').toArray()


        for (const obj of arrMonthly) {
            const id = $('a',obj).attr('href')?.replace(/\/archive\//gi,'') ?? ''
            const title = $('.title',obj).first().text().trim() ?? ''
            const image = $(source.thumbnailSelector, obj).attr('src') ?? ''
            monhtly.push(
                createMangaTile({
                    id,
                    image,
                    title: createIconText({ text:  this.decodeHTMLEntity(title) }),
                })
            )
        }
        section2.items = monhtly
        sectionCallback(section2)

        for (const obj of arrWeekly) {
            const id = $('a',obj).attr('href')?.replace(/\/archive\//gi,'') ?? ''
            const title = $('.title',obj).first().text().trim() ?? ''
            const image = $(source.thumbnailSelector, obj).attr('src') ?? ''
            weekly.push(
                createMangaTile({
                    id,
                    image,
                    title: createIconText({ text:  this.decodeHTMLEntity(title) }),
                })
            )
        }
        section1.items = weekly
        sectionCallback(section1)

        for (const obj of arrLatest) {
            const id = $('a',obj).attr('href')?.replace(/\/archive\//gi,'') ?? ''
            const title = $('.title',obj).first().text().trim() ?? ''
            const image = $(source.thumbnailSelector, obj).attr('src') ?? ''
            hot.push(
                createMangaTile({
                    id,
                    image,
                    title: createIconText({ text:  this.decodeHTMLEntity(title) }),
                })
            )
        }
        section3.items = hot
        sectionCallback(section3)
    }

    parseChapterDetails($: CheerioSelector, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        const totalPages = parseInt($('.total').first().text()) ?? ''
        const data_id = $('body').attr('data-id')
        const url = parse(($('.page img').attr('src') ?? '')) ?? ''
        const origin = `${url.protocol}//${url.host}`
        console.log(`total is ${totalPages}`)
        for (let i = 0; i < totalPages; i++) {
            pages.push(`${origin}/data/${data_id}/${i+1}.jpg`)
        }
        return createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages,
            longStrip: true
        })
    }

    parseChapters($: CheerioStatic, mangaId: string, _source: any): Chapter[] {
        const chapters: Chapter[] = []
        const url = $('.metadata .actions .read').attr('href')?.replace(/\/archive\//gi,'') ?? ''
        const release_date = parseInt($('.metadata .published td:nth-child(2)').attr('data-unix')?? '') * 1000 ?? ''
        chapters.push(createChapter({
            id: url, 
            mangaId: mangaId,
            name:  this.decodeHTMLEntity($('.metadata .title').first().text().trim()) ?? '', 
            chapNum: 1,
            time: new Date(release_date),
            langCode: LanguageCode.ENGLISH
        }))
        return chapters
    }

    parseMangaDetails($: CheerioStatic, mangaId: string, source: any): Manga {
        const title =  this.decodeHTMLEntity($('.metadata .title').first().text().trim()) ?? ''
        const image = $(source.thumbnailSelector).attr('src') ?? 'https://paperback.moe/icons/logo-alt.svg'
        const author = $('.metadata .circles a').text().trim() ?? ''
        const artist = $('.metadata .artists a').text().trim() ?? ''
        const arrayTags: Tag[] = []

        const genres = $(`.metadata .tags a, ${source.magazinesSelector}`).toArray()
        for (const obj of genres) {
            arrayTags.push({
                id: $(obj)?.attr('href') ?? '',
                label: $(obj).text() ?? ''
            })
        }
        const tagSections: TagSection[] = [createTagSection({ id: '0', label: 'genres', tags: arrayTags.map((x) => createTag(x)) })]

        return createManga({
            id: mangaId,
            titles: [title],
            image,
            status: MangaStatus.COMPLETED,
            author,
            artist,
            tags: tagSections,
        })
    }

    parseSearchResults($: CheerioSelector, source: any): MangaTile[] {
        const results: MangaTile[] = []
        for (const obj of $('#archives.feed .entries > .entry').toArray()) {
            const id = $('a',obj).attr('href')?.replace(/\/archive\//gi,'') ?? ''
            const title = $('.title',obj).text().trim() ?? ''
            const image = $(source.thumbnailSelector, obj).attr('src') ?? ''
            if (id || title){
                results.push(
                    createMangaTile({
                        id,
                        image,
                        title: createIconText({ text: this.decodeHTMLEntity(title) }),
                    })
                )
            }
        }
        return results
    }

    parseSearchResultsArchive($: CheerioSelector, source: any,archiveid: string): MangaTile[] {
        const results: MangaTile[] = []
        const id = archiveid ?? ''
        const title = $('.metadata .title').text().trim() ?? ''
        const image = $(source.thumbnailSelector).attr('src') ?? ''
        if (id || title){
            results.push(
                createMangaTile({
                    id,
                    image,
                    title: createIconText({ text: this.decodeHTMLEntity(title) }),
                })
            )
        }
        return results
    }
    NextPage($: CheerioSelector): boolean {
        const nextPage = $('#archives.feed .pagination .next')
        if (nextPage.contents().length !== 0) {
            return true
        } else {
            return false
        }
    }
}
