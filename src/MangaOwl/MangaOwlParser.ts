import {Chapter,     
    ChapterDetails,
    HomeSection,
    HomeSectionType,
    LanguageCode, 
    Manga, 
    MangaTile, 
    Tag,
    TagSection} from "paperback-extensions-common";

export class Parser {
    private readonly chapterTitleRegex = /Chapter ([\d.]+)/i
    public readonly chapterIdRegex = /\/reader\/reader\/\d+\/(\d+)/i
    decodeHTMLEntity(str: string): string {
        return str.replace(/&#(\d+);/g, function (_match, dec) {
            return String.fromCharCode(dec);
        })
    }

    async parseHomeSections($: CheerioStatic, sectionCallback: (section: HomeSection) => void, _source: any): Promise<void> {
        const section1 = createHomeSection({ id: '1', title: 'Must Read Today', type: HomeSectionType.singleRowNormal,})
        const section2 = createHomeSection({ id: '2', title: 'New Releases',      type: HomeSectionType.singleRowNormal,})
        const section3 = createHomeSection({ id: '3', title: 'Latest',    type: HomeSectionType.singleRowNormal,})
        const section4 = createHomeSection({ id: '4', title: 'Most Popular Manga',    type: HomeSectionType.singleRowNormal,})

        const popular : MangaTile[] = []
        const hot     : MangaTile[] = []
        const latest  : MangaTile[] = []
        const newManga: MangaTile[] = []

        const arrMustRead = $('div:nth-child(2) div.comicView').toArray()
        const arrNewRel = $('div.general div.comicView').toArray()
        const arrLatest = $('div.lastest div.comicView').toArray()
        const arrPopular = $('div:nth-child(5) div.comicView').toArray()


        for (const obj of arrMustRead) {
            const id = $(obj).attr("data-id") ?? ''
            const title = $(obj).attr("data-title") ?? ''
            const image = $('div[data-background-image]', obj).attr('data-background-image') ?? ''
            latest.push(
                createMangaTile({
                    id,
                    image,
                    title: createIconText({ text:  this.decodeHTMLEntity(title) }),
                })
            )
        }
        section1.items = latest
        sectionCallback(section1)

        for (const obj of arrNewRel) {
            const id = $(obj).attr("data-id") ?? ''
            const title = $(obj).attr("data-title") ?? ''
            const image = $('div[data-background-image]', obj).attr('data-background-image') ?? ''
            popular.push(
                createMangaTile({
                    id,
                    image,
                    title: createIconText({ text:  this.decodeHTMLEntity(title) }),
                })
            )
        }
        section2.items = popular
        sectionCallback(section2)

        for (const obj of arrLatest) {
            const id = $(obj).attr("data-id") ?? ''
            const title = $(obj).attr("data-title") ?? ''
            const image = $('div[data-background-image]', obj).attr('data-background-image') ?? ''
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

        for (const obj of arrPopular) {
            const id = $(obj).attr("data-id") ?? ''
            const title = $(obj).attr("data-title") ?? ''
            const image = $('div[data-background-image]', obj).attr('data-background-image') ?? ''
            newManga.push(
                createMangaTile({
                    id,
                    image,
                    title: createIconText({ text:  this.decodeHTMLEntity(title) }),
                })
            )
        }
        section4.items = newManga
        sectionCallback(section4)
    }
    // taken from TheNetSky/Madara on Github
    getImageSrc(imageObj: Cheerio | undefined): string {
        let image
        if(typeof imageObj?.attr('data-src') != 'undefined') {
            image = imageObj?.attr('data-src')
        }
        else if (typeof imageObj?.attr('data-lazy-src') != 'undefined') {
            image = imageObj?.attr('data-lazy-src')
        }
        else if (typeof imageObj?.attr('srcset') != 'undefined') {
            image = imageObj?.attr('srcset')?.split(' ')[0] ?? ''
        }
        else {
            image = imageObj?.attr('src')
        }
        return encodeURI(decodeURI(this.decodeHTMLEntity(image?.trim() ?? '')))
    }

    parseChapterDetails($: CheerioSelector, mangaId: string, chapterId: string, selector: string): ChapterDetails {
        let pages: string[] = []

        for (let obj of $(selector).toArray()) {
            let page = this.getImageSrc($(obj))
            if (!page) {
                throw new Error(`Could not parse page for ${mangaId}/${chapterId}`)
            }

            pages.push(page)
        }
        return createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages,
            longStrip: false
        })
    }
    findTextAndReturnRemainder(target: any, variable: any){
        var chopFront = target.substring(target.search(variable)+variable.length,target.length);
        var result = chopFront.substring(0,chopFront.search(";"));
        return result;
    }
    substringAfterFirst(substring: any, string: any){
        var startingIndexOfSubstring = string.indexOf(substring);
        var endIndexOfSubstring = startingIndexOfSubstring + substring.length - 1;
        return string.substring(endIndexOfSubstring + 1, string.length);
    }
    parseChapters($: CheerioStatic, mangaId: string, _source: any): Chapter[] {
        const chapters: Chapter[] = [];
        let lastNumber: number | null = null;
        var trElment = $(`script`).map((_i: any, x: any) => x.children[0])
        .filter((_i: any, x: any) => x && x.data.match(/window\['tr'] = '([^']*)';/)).get(0);
        var trElmen = trElment.data.trim()
        const matchX = this.findTextAndReturnRemainder(trElmen,`window['tr'] = `)
        var tr = matchX.replace(/^\s+|\s+$/g,'').replace(/['"]+/g, '')
        var s = Buffer.from("https://www.mangaowls.com").toString('base64')
        const arrChapters = $('div.table-chapter-list ul li:has(a)').toArray()
        for (const obj of arrChapters) {
            var chapterAElement = $('a',obj);
            var url = this.substringAfterFirst(".com", chapterAElement?.attr("data-href")?.replace("/reader/reader/", "/reader/"));
            var name = $('label',chapterAElement).text().trim();
            var dateParts = $("small:last-of-type", obj).first().text()
                const match = name.match(this.chapterTitleRegex);
                let chapNum;
                if (match && !isNaN(Number(match[1]))) {
                    chapNum = Number(match[1])
                } else {
                    if (lastNumber === null) {
                        chapNum = 0;
                    } else {
                        chapNum = Number((lastNumber + 0.001).toFixed(3))
                    }
                }
                lastNumber = chapNum
            chapters.push(createChapter({
            id: `${url}?tr=${tr}&s=${s}`, 
            mangaId: mangaId,
            name: this.encodeText(name) ? name : undefined, 
            chapNum: chapNum ?? 0,
            time: new Date(Number(dateParts)),
            langCode: LanguageCode.ENGLISH
        }));
        }
        return chapters
    }

    getPart($: CheerioStatic, partsArr: (string | null)[], index: number) {
        const toAdd = $("span").remove().end().text().replace(/\s{2,}/, " ").trim();
        if (toAdd) {
            partsArr[index] = toAdd
        }
    }

    parseMangaDetails($: CheerioStatic, mangaId: string, source: any): Manga {
        const details = $("div.single_detail")
        const title = $('h2',details).first().text().trim() ?? ''
        const image = $('img',details).attr('data-src') ?? $('img',details).attr('src') ?? 'https://paperback.moe/icons/logo-alt.svg'
        let desc = $("div.description").first().children().remove().end().text().replaceAll(/\s{2,}/g, " ").trim() ?? ''
        if (desc == '') desc = `No Decscription provided by the source (MangaOwl)`
        const author = $("p.fexi_header_para a.author_link",details).first().text().trim();
        const stu = $("p.fexi_header_para:contains('Status')",details).first().text().trim().replace(/STATUS:/gi,'');
        const arrayTags: Tag[] = []
        const genres = $('div.col-xs-12.col-md-8.single-right-grid-right > p > a[href*=genres]',details).toArray()
        for (const obj of genres) {
            arrayTags.push({
                id: $(obj)?.attr('href')?.replace("/genres/", "") ?? '',
                label: $(obj).text() ?? ''
            })
        }
        const tagSections: TagSection[] = [createTagSection({ id: '0', label: 'genres', tags: arrayTags.map((x) => createTag(x)) })]
        const status = source.parseStatus(stu)

        return createManga({
            id: mangaId,
            titles: [title],
            image,
            rating: 0,
            status,
            author,
            tags: tagSections,
            desc,
        })
    }

    parseTags($: CheerioStatic) {
        const genres: Tag[] = [];
        for (const obj of $("div.col-xs-12 div.row label").toArray()) {
            const id = ($('input',obj).attr("data-id") || "");
            genres.push(createTag({
                id: id,
                label: $(obj).text().trim()
            }));
        }
        return genres;
    }
    parseSearchResults($: CheerioSelector, _source: any): MangaTile[] {
        const results: MangaTile[] = []
        for (const obj of $('div.col-md-2').toArray()) {
            const id = $(obj).attr("data-id") ?? ''
            const title = $(obj).attr("data-title") ?? ''
            const image = $('div[data-background-image]', obj).attr('data-background-image') ?? ''
            if(id){
            results.push(
                createMangaTile({
                    id,
                    image,
                    title: createIconText({ text: title }),
                })
            )
        }
    }
        return results
    }
    parseTimesFromTilesResults($: CheerioSelector): MangaTile[] {
        const results: MangaTile[] = []
        for (const obj of $('div.col-md-2').toArray()) {
            const id = $(obj).attr("data-id") ?? ''
            console.log(id)
            const title = $(obj).attr("data-title") ?? ''
            console.log(title)
            const image = $('div[data-background-image]', obj).attr('data-background-image') ?? ''
            console.log(image)
            const timeneeded = $(obj).attr("data-chapter-time") ?? ""
            console.log(timeneeded)
            results.push(
                createMangaTile({
                    id,
                    image,
                    title: createIconText({ text: title }),
                    primaryText: createIconText({
                        text: timeneeded 
                    })
                }))
    }
        console.log(`Results are ${JSON.stringify(results)}`)
        return results
    }
    parseTimesFromTiles($: CheerioStatic, dateTime: Date) {
        const tiles = this.parseTimesFromTilesResults($) 
        console.log(`Pass 1 ${JSON.stringify(tiles)}`)
        const ids: string[] = [];
        console.log(`Pass 2 ${ids}`)
        for (let i = 0; i < tiles.length; i++) {
            const tile = tiles[i];
            console.log(`Pass 3 ${JSON.stringify(tiles[i])}`)
            if (tile?.primaryText) {
                console.log(`Pass 4 ${JSON.stringify(tile?.primaryText)}`)
                const parts = tile.primaryText.text.split(" ");
                console.log(`Pass 5 ${parts}`)
                if (parts.length === 2) {
                    const dayPart = parts[0]
                    console.log(`Pass 6 ${dayPart}`)
                    const daySubparts = dayPart?.split("-")
                    console.log(`Pass 7 ${daySubparts}`)
                    if (daySubparts?.length === 3) {
                        const year = Number(daySubparts[0])
                        console.log(`Pass 8 ${year}`)
                        const month = Number(daySubparts[1]) - 1
                        console.log(`Pass 9 ${month}`)
                        const day = Number(daySubparts[2])
                        console.log(`Pass 10 ${day}`)
                        const timePart = parts[1];
                        console.log(`Pass 11 ${timePart}`)
                        const timeSubparts = timePart?.split(":")
                        console.log(`Pass 12 ${timeSubparts}`)
                        if (timeSubparts?.length === 2) {
                            const hour = Number(timeSubparts[0])
                            console.log(`Pass 13 ${hour}`)
                            const minute = Number(timeSubparts[1])
                            console.log(`Pass 14 ${minute}`)
                            const dateObj = new Date(Date.UTC(year, month, day, hour, minute));
                            console.log(`Pass 15 ${dateObj}`)
                            if (dateObj > dateTime) {
                                console.log(`Pass 16 ${dateObj > dateTime}`)
                                ids.push(tile.id);
                            }
                        }
                    }
                }
            }
        }
        if (ids.length !== 0) {
            console.log(`Pass 17 pass it`)
            return ids;
        } else {
            console.log(`Pass 18 did not pass it`)
            return null;
        }
    }
    encodeText(str: string) {
        return str.replace(/&#([0-9]{1,4});/gi, (_, numStr) => {
            const num = parseInt(numStr, 10)
            return String.fromCharCode(num)
        })
    }
}