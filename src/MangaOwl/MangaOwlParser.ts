import {Chapter,     
    ChapterDetails,
    HomeSection,
    LanguageCode, 
    Manga, 
    MangaTile, 
    Tag,
    TagSection} from 'paperback-extensions-common'

export class Parser {
    private readonly chapterTitleRegex = /Chapter ([\d.]+)/i
    public readonly chapterIdRegex = /\/reader\/reader\/\d+\/(\d+)/i

    decodeHTMLEntity(str: string): string {
        return str.replace(/&#(\d+)/g, (_match, dec) => {
            return String.fromCharCode(dec)
        })
    }

    async parseHomeSections($: CheerioStatic,sectionCallback: (section: HomeSection) => void, source: any): Promise<void> {
        const section1 = createHomeSection({ id: '1', title: 'Must Read Today', view_more: false})
        const section2 = createHomeSection({ id: '2', title: 'New Releases', view_more: true})
        const section3 = createHomeSection({ id: '3', title: 'Latest', view_more: true})
        const section4 = createHomeSection({ id: '4', title: 'Most Popular Manga', view_more: true})

        const popular : MangaTile[] = []
        const hot     : MangaTile[] = []
        const latest  : MangaTile[] = []
        const newManga: MangaTile[] = []

        const arrMustRead = $('div:nth-child(2) div.comicView').toArray()
        const arrNewRel = $('div.general div.comicView').toArray()
        const arrLatest = $('div.lastest div.comicView').toArray()
        const arrPopular = $('div:nth-child(5) div.comicView').toArray()


        for (const obj of arrMustRead) {
            const id = this.idCleaner($('h6 a',obj).attr('href') ?? '',source) ?? ''
            const title = this.decodeHTMLEntity($('h6 a',obj).text().trim()) ?? ''
            const image = $('div[data-background-image]', obj).attr('data-background-image') ?? ''
            const subTitle = $('.tray-item', obj).text().trim() ?? ''
            latest.push(
                createMangaTile({
                    id,
                    image,
                    title: createIconText({ text:  this.decodeHTMLEntity(title) }),
                    subtitleText: createIconText({ text: subTitle }),
                })
            )
        }
        section1.items = latest
        sectionCallback(section1)

        for (const obj of arrNewRel) {
            const id = this.idCleaner($('h6 a',obj).attr('href') ?? '',source) ?? ''
            const title = this.decodeHTMLEntity($('h6 a',obj).text().trim()) ?? ''
            const image = $('div[data-background-image]', obj).attr('data-background-image') ?? ''
            const subTitle = $('.tray-item', obj).text().trim() ?? ''
            popular.push(
                createMangaTile({
                    id,
                    image,
                    title: createIconText({ text:  this.decodeHTMLEntity(title) }),
                    subtitleText: createIconText({ text: subTitle }),
                })
            )
        }
        section2.items = popular
        sectionCallback(section2)

        for (const obj of arrLatest) {
            const id = this.idCleaner($('h6 a',obj).attr('href') ?? '',source) ?? ''
            const title = this.decodeHTMLEntity($('h6 a',obj).text().trim()) ?? ''
            const image = $('div[data-background-image]', obj).attr('data-background-image') ?? ''
            const subTitle = $('.tray-item', obj).text().trim() ?? ''
            hot.push(
                createMangaTile({
                    id,
                    image,
                    title: createIconText({ text:  this.decodeHTMLEntity(title) }),
                    subtitleText: createIconText({ text: subTitle }),
                })
            )
        }
        section3.items = hot
        sectionCallback(section3)

        for (const obj of arrPopular) {
            const id = this.idCleaner($('h6 a',obj).attr('href') ?? '',source) ?? ''
            const title = this.decodeHTMLEntity($('h6 a',obj).text().trim()) ?? ''
            const image = $('div[data-background-image]', obj).attr('data-background-image') ?? ''
            const subTitle = $('.tray-item', obj).text().trim() ?? ''
            newManga.push(
                createMangaTile({
                    id,
                    image,
                    title: createIconText({ text:  this.decodeHTMLEntity(title) }),
                    subtitleText: createIconText({ text: subTitle }),
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
        const pages: string[] = []

        for (const obj of $(selector).toArray()) {
            const page = this.getImageSrc($(obj))
            if (!page) {
                throw new Error(`Could not parse page for ${chapterId}`)
            }

            pages.push(page)
        }
        return createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages,
            longStrip: true
        })
    }
    findTextAndReturnRemainder(target: any, constiable: any): string {
        const chopFront = target.substring(target.search(constiable)+constiable.length,target.length)
        const result = chopFront.substring(0,chopFront.search(''))
        return result
    }
    substringAfterFirst(substring: any, string: any): string {
        const startingIndexOfSubstring = string.indexOf(substring)
        const endIndexOfSubstring = startingIndexOfSubstring + substring.length - 1
        return string.substring(endIndexOfSubstring + 1, string.length)
    }
    parseChapters($: CheerioStatic, mangaId: string, _source: any): Chapter[] {
        const chapters: Chapter[] = []
        let lastNumber: number | null = null
        const trElment = $('script').map((_i: any, x: any) => x.children[0]).filter((_i: any, x: any) => x && x.data.match(/window\['tr'] = '([^']*)'/)).get(0)
        const trElmen = trElment.data.trim()
        const matchX = this.findTextAndReturnRemainder(trElmen,'window[\'tr\'] = ')
        const tr = matchX.replace(/^\s+|\s+$/g,'').replace(/['']+/g, '')
        const s = Buffer.from('https://www.mangaowls.com').toString('base64')
        const arrChapters = $('div.table-chapter-list ul li:has(a)').toArray()
        for (const obj of arrChapters) {
            const chapterAElement = $('a',obj)
            const url = this.substringAfterFirst('.com', chapterAElement?.attr('data-href')?.replace('/reader/reader/', '/reader/'))
            const name = $('label',chapterAElement).text().trim() ?? 'No Chpater Name'
            const release_date = $('small:last-of-type', obj).first().text().split('/')
            const month = Number(release_date[0])
            const day = Number(release_date[1])
            const year = Number(release_date[2])
            const match = name.match(this.chapterTitleRegex)
            let chapNum
            if (match && !isNaN(Number(match[1]))) {
                chapNum = Number(match[1])
            } else {
                if (lastNumber === null) {
                    chapNum = 0
                } else {
                    chapNum = Number((lastNumber + 0.001).toFixed(3))
                }
            }
            lastNumber = chapNum
            chapters.push(createChapter({
                id: `${url}?tr=${tr}&s=${s}`, 
                mangaId: mangaId,
                name: this.encodeText(name), 
                chapNum: chapNum ?? 0,
                time: new Date(`${year}/${month}/${day}`),
                langCode: LanguageCode.ENGLISH
            }))
        }
        return chapters
    }

    parseMangaDetails($: CheerioStatic, mangaId: string, source: any): Manga {
        const details = $('div.single_detail')
        const title = $('h2',details).first().text().trim() ?? ''
        const image = $('img',details).attr('data-src') ?? $('img',details).attr('src') ?? 'https://paperback.moe/icons/logo-alt.svg'
        let desc = $('div.description').first().children().remove().end().text().replaceAll(/\s{2,}/g, ' ').trim() ?? ''
        if (desc == '') desc = 'No Decscription provided by the source (MangaOwl)'
        let author = ''
        let artist = ''
        let status = ''
        let views = ''
        const arrayTags: Tag[] = []
        const rating = Number($('font.rating_scored').text().trim() || '0')
        const info = $('p.fexi_header_para',details).toArray()
        for (const obj of info) {
            const label = $('span', obj).first().children().remove().end().text().replace(/\s{2,}/, ' ').trim().toLowerCase()
            switch (label) {
                case 'author':
                case 'authors':
                case 'author(s)':
                    $('span', obj).remove().end().text().replace(/\s{2,}/, ' ').trim()
                    author = $(obj).text().trim()
                    break
                case 'artist':
                case 'artists':
                case 'artist(s)':
                    $('span', obj).remove().end().text().replace(/\s{2,}/, ' ').trim()
                    artist = $(obj).text().trim()
                    break
                case 'views':
                    $('span', obj).remove().end().text().replace(/\s{2,}/, ' ').trim()
                    views = $(obj).text().trim()
                    break
                case 'status':
                    $('span', obj).remove().end().text().replace(/\s{2,}/, ' ').trim()
                    status = $(obj).text().trim()
                    break
            }
        }
        const genres = $('div.col-xs-12.col-md-8.single-right-grid-right > p > a[href*=genres]',details).toArray()
        for (const obj of genres) {
            arrayTags.push({
                id: $(obj)?.attr('href')?.replace('/genres/', '') ?? '',
                label: $(obj).text() ?? ''
            })
        }
        const tagSections: TagSection[] = [createTagSection({ id: '0', label: 'genres', tags: arrayTags.map((x) => createTag(x)) })]

        return createManga({
            id: mangaId,
            titles: [title],
            image,
            rating: rating,
            status: source.parseStatus(status),
            views: Number(views),
            author,
            artist,
            tags: tagSections,
            desc,
        })
    }

    parseTags($: CheerioStatic) {
        const genres: Tag[] = []
        for (const obj of $('div.col-xs-12 div.row label').toArray()) {
            const id = ($('input',obj).attr('data-id') || '')
            genres.push(createTag({
                id: id,
                label: $(obj).text().trim()
            }))
        }
        return genres
    }
    parseSearchResults($: CheerioSelector, source: any): MangaTile[] {
        const results: MangaTile[] = []
        for (const obj of $('div.col-md-2').toArray()) {
            const id = this.idCleaner($('h6 a',obj).attr('href') ?? '',source) ?? ''
            const title = this.decodeHTMLEntity($('h6 a',obj).text().trim()) ?? ''
            const image = $('div[data-background-image]', obj).attr('data-background-image') ?? ''
            const subTitle = $('.tray-item', obj).text().trim() ?? ''
            if(id){
                results.push(
                    createMangaTile({
                        id,
                        image,
                        title: createIconText({ text: this.decodeHTMLEntity(title) }),
                        subtitleText: createIconText({ text: subTitle }),
                    })
                )
            }
        }
        return results
    }

    parseTimesFromTilesResults($: CheerioSelector, source: any): MangaTile[] {
        const results: MangaTile[] = []
        for (const obj of $('div.col-md-2').toArray()) {
            const id = this.idCleaner($('h6 a',obj).attr('href') ?? '',source) ?? ''
            const title = this.decodeHTMLEntity($('h6 a',obj).text().trim()) ?? ''
            const image = $('div[data-background-image]', obj).attr('data-background-image') ?? ''
            const timeneeded = $(obj).attr('data-chapter-time') ?? ''
            results.push({
                id: id,
                image: image,
                title: createIconText({ text: this.decodeHTMLEntity(title) }),
                primaryText: createIconText({
                    text: timeneeded 
                })
            })
        }
        return results
    }

    parseTimesFromTiles($: CheerioStatic, dateTime: Date,source:any): any {
        const tiles = this.parseTimesFromTilesResults($,source) 
        const ids: string[] = []
        for (let i = 0; i < tiles.length; i++) {
            const tile = tiles[i]
            if (tile?.primaryText) {
                const parts = tile.primaryText.text.split(' ')
                if (parts.length === 2) {
                    const dayPart = parts[0]
                    const daySubparts = dayPart?.split('-')
                    if (daySubparts?.length === 3) {
                        const year = Number(daySubparts[0])
                        const month = Number(daySubparts[1]) - 1
                        const day = Number(daySubparts[2])
                        const timePart = parts[1]
                        const timeSubparts = timePart?.split(':')
                        if (timeSubparts?.length === 2) {
                            const hour = Number(timeSubparts[0])
                            const minute = Number(timeSubparts[1])
                            const dateObj = new Date(Date.UTC(year, month, day, hour, minute))
                            if (dateObj > dateTime) {
                                ids.push(tile.id)
                            }
                        }
                    }
                }
            }
        }
        if (ids.length !== 0) {
            return ids
        } else {
            return null
        }
    }
    encodeText(str: string): string {
        return str.replace(/&#([0-9]{1,4});/gi, (_, numStr) => {
            const num = parseInt(numStr, 10)
            return String.fromCharCode(num)
        })
    }
    idCleaner(str: string, source: any): string {
        const base = source.baseUrl.split('://').pop()
        str = str.replace(/(https:\/\/|http:\/\/)/, '')
        str = str.replace(/\/$/, '')
        str = str.replace(`${base}/`, '')
        str = str.replace('/single/', '')
        return str
    }
}