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

        cy.get('button[aria-label="切换到中文"]').click()

        cy.get('html').should('have.attr', 'lang', 'zh-CN')
        cy.title().should('eq', '雪雁的HRT指南（MTF）')
        cy.contains('h1', '雪雁的HRT指南（MTF）').should('be.visible')
        cy.window().its('localStorage').invoke('getItem', 'lycoris.language.v1').should('eq', 'zh')
    })

    it('keeps the selected language after a refresh', () => {
        visitEnglishGuide()
        cy.get('button[aria-label="切换到中文"]').click()
        cy.reload()

        cy.get('html').should('have.attr', 'lang', 'zh-CN')
        cy.title().should('eq', '雪雁的HRT指南（MTF）')
        cy.contains('h1', '雪雁的HRT指南（MTF）').should('be.visible')
        cy.get('button[aria-label="Switch to English"]').should('be.visible')
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

        cy.get('button[aria-label="切换到中文"]').click()

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
