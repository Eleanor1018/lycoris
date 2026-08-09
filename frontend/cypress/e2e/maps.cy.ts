describe('Maps', () => {
    beforeEach(() => {
        cy.intercept('GET', '/api/me', {
            statusCode: 200,
            body: { data: null },
        })
        cy.intercept('GET', '/api/markers/viewport*', {
            statusCode: 200,
            body: [],
        })
    })

    it('renders nearby button in disabled state by default', () => {
        cy.visit('/maps')
        cy.contains('附近无障碍卫生间').should('exist').and('be.disabled')
        cy.contains('button', '筛选点位').click()
        cy.contains('图例').should('be.visible')
        cy.contains('label', '母婴室').should('be.visible')
        cy.contains('扭转机构').should('not.exist')

        cy.get('button[aria-label="打开地图设置"]').click()
        cy.contains('附近查询类型')
            .parent()
            .within(() => {
                cy.contains('button', '母婴室').should('be.visible')
            })
        cy.contains('扭转机构').should('not.exist')
    })

    it('enables nearby button after geolocation resolves', () => {
        cy.visit('/maps', {
            onBeforeLoad(win) {
                Object.defineProperty(win.navigator, 'geolocation', {
                    configurable: true,
                    value: {
                        watchPosition(success: (position: GeolocationPosition) => void) {
                            success({
                                coords: {
                                    latitude: 41.8781,
                                    longitude: -87.6298,
                                    accuracy: 10,
                                    altitude: null,
                                    altitudeAccuracy: null,
                                    heading: null,
                                    speed: null,
                                    toJSON: () => ({}),
                                },
                                timestamp: Date.now(),
                                toJSON: () => ({}),
                            } as GeolocationPosition)
                            return 1
                        },
                        clearWatch() {
                            // no-op for tests
                        },
                    },
                })
            },
        })

        cy.contains('附近无障碍卫生间')
            .should('exist')
            .and('not.be.disabled')
    })
})
