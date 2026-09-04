describe('Language switch', () => {
    beforeEach(() => {
        cy.viewport(1280, 800)
    })

    const visitEnglishGuide = () => {
        cy.visit('/documents/nora-hrt-guide', {
            onBeforeLoad(win) {
                win.localStorage.setItem('lycoris.language.v1', 'en')
            },
        })
    }

    it('switches the navbar and guide immediately', () => {
        visitEnglishGuide()
        cy.get('html').should('have.attr', 'lang', 'en')
        cy.title().should('eq', "Nora's HRT Guide (MTF)")
        cy.contains('h1', "Nora's HRT Guide (MTF)").should('be.visible')

        cy.get('button[aria-label="Switch to Chinese"]').click()

        cy.get('html').should('have.attr', 'lang', 'zh-CN')
        cy.title().should('eq', '雪雁的HRT指南（MTF）')
        cy.contains('h1', '雪雁的HRT指南（MTF）').should('be.visible')
        cy.window().its('localStorage').invoke('getItem', 'lycoris.language.v1').should('eq', 'zh')
    })

    it('keeps the selected language after a refresh', () => {
        visitEnglishGuide()
        cy.get('button[aria-label="Switch to Chinese"]').click()
        cy.reload()

        cy.get('html').should('have.attr', 'lang', 'zh-CN')
        cy.title().should('eq', '雪雁的HRT指南（MTF）')
        cy.contains('h1', '雪雁的HRT指南（MTF）').should('be.visible')
        cy.get('button[aria-label="切换到英文"]').should('be.visible')
    })

    it('uses the new language for the first request triggered by switching', () => {
        cy.intercept('GET', '**/api/markers/search*', (request) => {
            if (request.headers['accept-language'] === 'zh-CN') {
                request.alias = 'localizedSearch'
            }
            request.reply([])
        })
        cy.visit('/search?q=restroom', {
            onBeforeLoad(win) {
                win.localStorage.setItem('lycoris.language.v1', 'en')
            },
        })

        cy.get('button[aria-label="Switch to Chinese"]').click()

        cy.wait('@localizedSearch').its('request.headers.accept-language').should('eq', 'zh-CN')
    })

    it('uses the browser language on the first visit', () => {
        cy.intercept('GET', '**/api/me', {
            statusCode: 401,
            body: { message: '未登录' },
        }).as('initialMe')

        cy.visit('/', {
            onBeforeLoad(win) {
                win.localStorage.removeItem('lycoris.language.v1')
                Object.defineProperty(win.navigator, 'language', {
                    configurable: true,
                    get: () => 'zh-CN',
                })
                Object.defineProperty(win.navigator, 'languages', {
                    configurable: true,
                    get: () => ['zh-CN', 'zh'],
                })
            },
        })

        cy.window().its('navigator.language').should('eq', 'zh-CN')
        cy.wait('@initialMe')
            .its('request.headers')
            .should((headers) => {
                expect(headers['accept-language']).to.eq('zh-CN')
            })
        cy.get('html').should('have.attr', 'lang', 'zh-CN')
        cy.contains('为跨性别群体分享无障碍设施').should('be.visible')
        cy.contains('A platform sharing accessible facilities').should('not.exist')
    })
})

describe('Responsive language navigation', () => {
    const drawerId = '#lycoris-mobile-navigation'

    const visitEnglishHome = () => {
        cy.intercept('GET', '/api/me', {
            statusCode: 401,
            body: { message: '未登录' },
        })
        cy.visit('/', {
            onBeforeLoad(win) {
                win.localStorage.setItem('lycoris.language.v1', 'en')
            },
        })
    }

    it('shows the language switch in the desktop navbar', () => {
        cy.viewport(1280, 800)
        visitEnglishHome()

        cy.get('[data-testid="desktop-language-toggle"]')
            .filter(':visible')
            .should('have.length', 1)
    })

    ;[320, 375].forEach((width) => {
        it(`keeps the language switch in the drawer at ${width}px`, () => {
            cy.viewport(width, 812)
            visitEnglishHome()

            cy.get('[data-testid="desktop-language-toggle"]').should('not.be.visible')
            cy.get('button[aria-label="Open login navigation"]').click()

            cy.get(drawerId).should('be.visible').within(() => {
                cy.get('[data-testid="mobile-language-toggle"]').should('be.visible')
                cy.contains('Language').should('be.visible')
            })
        })
    })

    it('switches language from the mobile drawer and remembers it after refresh', () => {
        cy.viewport(375, 812)
        visitEnglishHome()

        cy.get('[data-testid="desktop-language-toggle"]').should('not.be.visible')
        cy.get('button[aria-label="Open login navigation"]').click()
        cy.get(drawerId).should('be.visible').within(() => {
            cy.get('[data-testid="mobile-language-toggle"]').click()
        })

        cy.get('html').should('have.attr', 'lang', 'zh-CN')
        cy.get(drawerId).should('be.visible').within(() => {
            cy.contains('语言').should('be.visible')
        })
        cy.window().its('localStorage').invoke('getItem', 'lycoris.language.v1').should('eq', 'zh')

        cy.reload()
        cy.get('html').should('have.attr', 'lang', 'zh-CN')
        cy.contains('a', '打开地图').should('be.visible')
        cy.get('button[aria-label="打开登录导航菜单"]').click()
        cy.get(drawerId).should('be.visible').within(() => {
            cy.get('[data-testid="mobile-language-toggle"]').should('be.visible')
            cy.contains('语言').should('be.visible')
        })
    })
})
