import { LitElement, type PropertyValueMap, css, html, nothing } from 'lit';
import { customElement, eventOptions, property, query, queryAssignedElements } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { map } from 'lit/directives/map.js';

const MIN_SLIDING_VALIDATION = 25;
const MIN_PAGE_CHANGE_VALIDATION = 50;

const debounce = (cb: Function, delay: number = 1000) => {
    let timer: ReturnType<typeof setTimeout>;
    return (...args: any[]) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            cb(...args);
        }, delay);
    };
};

const clamp = (nb: number, { min = -Infinity, max = Infinity }) => {
    return Math.max(min, Math.min(Number(nb) || min, max));
}

export type ZCarouselChangeEvent = CustomEvent<{ current: number; next: number }>;

@customElement('z-carousel')
export class ZCarousel extends LitElement {
    static events = {
        change: 'change',
    } as const;

    /**
     * =========== Dom References
     */
    @query('.carousel__content')
    private _contentEl!: HTMLElement;

    /*
     * =========== Props
     */
    @property({ attribute: 'current-page', type: Number })
    currentPage = 1;

    @property({ type: Boolean })
    navigation = false;

    @property({ type: Boolean })
    loop = false;

    @property({ type: Boolean })
    pagination = false;

    @property({ type: Boolean })
    dots = false;

    @property({ attribute: 'per-page', type: Number })
    perPage = 1;

    @property({ attribute: 'per-move', type: Number })
    perMove?: number;

    @property({ type: Number })
    gap = 0;

    @property({ attribute: 'offset-start', type: Number })
    offsetStart = 0;

    @property({ attribute: 'offset-end', type: Number })
    offsetEnd = 0;

    @property({ type: Boolean })
    drag = false;

    @property({ type: Boolean })
    disabled = false;

    @queryAssignedElements()
    private readonly slideElements!: HTMLElement[];

    private _touch = {
        initialX: 0,
        startX: 0,
        moveX: 0,
        validated: false,
    };

    private _mouse = {
        startX: 0,
        moveX: 0,
        initialX: 0,
        validated: false,
        isDragging: false,
    };

    /**
     * =========== data
     */
    private _resizeObserver!: ResizeObserver;

    /*
     * =========== Computed
     */
    private get _perPage() {
        return clamp(this.perPage, { min: 1 });
    }

    private get _perMove() {
        return !this.perMove ? this._perPage : clamp(this.perMove, { min: 1, max: this._perPage });
    }

    private get _gap() {
        return clamp(this.gap, { min: 0 });
    }

    private get _offsetStart() {
        return clamp(this.offsetStart, { min: 0 });
    }

    private get _offsetEnd() {
        return clamp(this.offsetEnd, { min: 0 });
    }

    private get _currentPage() {
        return clamp(this.currentPage, { min: 1, max: this._nbPages });
    }

    private get _nbPages() {
        return Math.ceil(this.slideElements.length / this._perMove);
    }

    private get _canGoPrevious() {
        if (this.loop) return true;
        return this._currentPage > 1;
    }

    private get _canGoNext() {
        if (this.loop) return true;
        return this._currentPage < this._nbPages;
    }

    private get _nbShadowElements() {
        const lastViewStart = (this._nbPages - 1) * this._perMove;
        const remaining = this.slideElements.length - lastViewStart;
        return remaining < this._perPage ? this._perPage - remaining : 0;
    }

    /*
     * =========== Lifecycle
     */
    override firstUpdated(changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>) {
        this.goToPage(this._currentPage, 'instant');

        // react to element resize
        this._resizeObserver = new ResizeObserver(this._debouncedOnResize.bind(this));
        this._resizeObserver.observe(this._contentEl);

        super.firstUpdated(changedProperties);
    }

    override updated(changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>) {
        if (changedProperties.has('currentPage')) this._updateScroll();

        // Mettre à jour les snap points quand perMove change
        if (changedProperties.has('perPage') || changedProperties.has('perMove') || changedProperties.has('slideElements')) {
            this._updateSnapPoints();
        }

        super.update(changedProperties);
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();

        this._resizeObserver.disconnect();
    }

    /*
     * =========== Methods
     */
    private _debouncedOnResize = debounce(this._onResize.bind(this), 200);
    private _onResize() {
        this._updateScroll('instant');
    }

    private _onKeyDown(e: KeyboardEvent) {
        if (this.disabled || e.target !== this._contentEl) return;

        // prevent the native scroll on key down
        if(['ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();

        if (e.key === 'ArrowLeft') this.goToPreviousPage();
        else if (e.key === 'ArrowRight') this.goToNextPage();
    }

    private _onWheel(e: WheelEvent) {
        if (this.disabled || e.target !== this._contentEl && !this.contains(e.target as Node)) return;

        // prevent the native scroll on whell horizontal scroll
        if (e.deltaX !== 0) e.preventDefault();

        if (e.deltaX < 0) this.goToPreviousPage();
        else if (e.deltaX > 0) this.goToNextPage();
    }

    private _onTouchStart(e: TouchEvent) {
        if (this.disabled) return;

        this._touch.startX = e.touches[0].clientX;
        this._touch.initialX = this._contentEl.scrollLeft;
    }

    private _onTouchMove(e: TouchEvent) {
        if (this.disabled) return;

        this._touch.moveX = e.touches[0].clientX;
        const deltaX = this._touch.moveX - this._touch.startX;

        // start scrolling the carousel only when touch validated and the screen is not scrolling
        if (Math.abs(deltaX) > MIN_SLIDING_VALIDATION) this._touch.validated = e.cancelable ;

        if (this._touch.validated) {
            e.preventDefault(); // prevent the page from scrolling when scrolling the carousel
            this._contentEl.scrollTo({ left: this._touch.initialX - deltaX, behavior: 'instant' });
        }
    }

    private _onTouchEnd() {
        if (this.disabled) return;

        if (this._touch.validated) {
            const deltaX = this._touch.moveX - this._touch.startX;

            // if translated at least, go to direction page otherwize only reset the scroll
            if (deltaX > MIN_PAGE_CHANGE_VALIDATION) {
                this.goToPreviousPage();
            } else if (deltaX < -MIN_PAGE_CHANGE_VALIDATION) {
                this.goToNextPage();
            } else {
                this._updateScroll('instant');
            }
        }

        // Reset touch values
        this._touch.startX = 0;
        this._touch.moveX = 0;
        this._touch.initialX = 0;
        this._touch.validated = false;
    }

    @eventOptions({ capture: true })
    private _onMouseDown(e: MouseEvent) {
        if (this.disabled || !this.drag) return;

        this._mouse.startX = e.screenX;
        this._mouse.initialX = this._contentEl.scrollLeft;
        this._mouse.isDragging = true;
    }

    private _onMouseMove(e: MouseEvent) {
        if (this.disabled || !this.drag) return;

        if (this._mouse.isDragging) {
            this._mouse.moveX = e.screenX;
            const deltaX = this._mouse.moveX - this._mouse.startX;

            if (Math.abs(deltaX) > MIN_SLIDING_VALIDATION) this._mouse.validated = true;

            if (this._mouse.validated) {
                this._contentEl.scroll({ left: this._mouse.initialX - deltaX, behavior: 'instant' });
            }
        }
    }

    private _onMouseUp() {
        if (this.disabled || !this.drag) return;

        if (this._mouse.validated) {
            const deltaX = this._mouse.moveX - this._mouse.startX;

            if (deltaX > MIN_PAGE_CHANGE_VALIDATION) {
                this.goToPreviousPage();
            } else if (deltaX < -MIN_PAGE_CHANGE_VALIDATION) {
                this.goToNextPage();
            } else {
                this._updateScroll();
            }
        }

        // reset mouse values
        this._mouse.startX = 0;
        this._mouse.moveX = 0;
        this._mouse.validated = false;
        this._mouse.isDragging = false;
    }

    private _updateScroll(behavior: ScrollBehavior = 'auto') {
        const currentSlideIndex = (this._currentPage - 1) * this._perMove;
        const targetElement = this.slideElements[currentSlideIndex];

        if (!targetElement) {
            console.warn(`[ZCarousel]: cannot find slide element at index ${currentSlideIndex}`);
            return;
        }

        this._contentEl.scrollTo({ left: targetElement.offsetLeft - this._offsetStart, behavior });
    }

    goToPreviousPage(behavior: ScrollBehavior = 'auto') {
        if (!this._canGoPrevious) return;
        this.goToPage(this._currentPage === 1 ? this._nbPages : (this._currentPage - 1), behavior);
    }

    goToNextPage(behavior: ScrollBehavior = 'auto') {
        if (!this._canGoNext) return;
        this.goToPage(this._currentPage === this._nbPages ? 1 : (this._currentPage + 1), behavior);
    }

    goToPage(pageNumber: number = 0, behavior: ScrollBehavior = 'auto') {
        if (this._currentPage !== pageNumber) {
            const evt: ZCarouselChangeEvent = new CustomEvent(ZCarousel.events.change, {
                bubbles: true,
                composed: true,
                cancelable: true,
                detail: {
                    current: this._currentPage,
                    next: pageNumber
                }
            });

            this.dispatchEvent(evt);

            if (!evt.defaultPrevented) this.currentPage = pageNumber; // triggers update !
        }

        this._updateScroll(behavior);
    }


    private _updateSnapPoints() {
        this.slideElements.forEach((el, index) => {
            // Snap sur chaque élément qui est un multiple de perMove
            if (index % this._perMove === 0) {
                el.setAttribute('z-carousel-snap-point', '');
            } else {
                el.removeAttribute('z-carousel-snap-point');
            }
        });
    }

    /**
     * =========== Template
     */
    render() {
        return html`
            <style>
                :host {
                    /* OVERRIDES the user set style */
                    --_z-carousel-gap: ${this._gap}px;
                    --_z-carousel-per-page: ${this._perPage};
                    --_z-carousel-offset-start: ${this._offsetStart}px;
                    --_z-carousel-offset-end: ${this._offsetEnd}px;
                }
            </style>

            <div
                class="carousel"
                role="toolbar">
                <div
                    class="carousel__content"
                    part="content"
                    aria-live="polite"
                    role="listbox"
                    tabindex="0"
                    @keydown="${this._onKeyDown}"
                    @wheel="${this._onWheel}"
                    @touchstart="${this._onTouchStart}"
                    @touchmove="${this._onTouchMove}"
                    @touchend="${this._onTouchEnd}"
                    @mousedown="${this._onMouseDown}"
                    @mousemove="${this._onMouseMove}"
                    @mouseup="${this._onMouseUp}">
                    <slot></slot>

                    ${this._renderShadowElements()}
                </div>

                ${this._renderPrevArrow()}

                ${this._renderNextArrow()}

                ${this._renderPagination()}

                ${this._renderDots()}

                <slot name="overlay"></slot>
            </div>
        `
    }

    private _renderShadowElements() {
        return Array.from({ length: this._nbShadowElements }, () => html`<div aria-hidden="true" class="carousel__content__shadow-element"></div>`);
    }

    private _renderPrevArrow() {
        return when(
            this.navigation,
            () => html`
                <button
                    ?disabled="${this.disabled || !this._canGoPrevious}"
                    aria-hidden="${!this._canGoPrevious}"
                    part="nav-btn nav-btn--prev ${(this.disabled || !this._canGoPrevious) ? 'nav-btn--disabled' : ''}"
                    class="carousel__btn carousel__nav carousel__nav--prev"
                    @click="${() => !this.disabled && this.goToPreviousPage()}"
                    type="button">
                    <slot name="nav-prev">
                        &lsaquo;
                    </slot>
                </button>
            `,
            () => nothing
        );
    }

    private _renderNextArrow() {
        return when(
            this.navigation,
            () => html`
                <button
                    ?disabled="${this.disabled || !this._canGoNext}"
                    aria-hidden="${!this._canGoNext}"
                    part="nav-btn nav-btn--next ${(this.disabled || !this._canGoNext) ? 'nav-btn--disabled' : ''}"
                    class="carousel__btn carousel__nav carousel__nav--next"
                    @click="${() => !this.disabled && this.goToNextPage()}"
                    type="button">
                    <slot name="nav-next">
                        &rsaquo;
                    </slot>
                </button>
            `,
            () => nothing
        );
    }

    private _renderPagination() {
        return when(
            this.pagination,
            () => html`
                <div
                    aria-live="polite"
                    aria-atomic="true"
                    part="pagination"
                    class="carousel__pagination">
                    ${this._currentPage} / ${this._nbPages}
                </div>
            `,
            () => nothing
        );
    }

    private _renderDots() {
        return when(
            this.dots,
            () => html`
                <div
                part="dots"
                role="listbox"
                class="carousel__dots">
                ${map(
                    Array.from({ length: this._nbPages }) as HTMLElement[],
                    (_slideEl: HTMLElement, index: number) => html`
                        <button
                            ?disabled="${this.disabled || (index + 1) === this._currentPage}"
                            aria-selected="${(index + 1) === this._currentPage}"
                            type="button"
                            role="button"
                            part="dots-item ${(index + 1) === this._currentPage ? 'dots-item--active' : ''}"
                            class="carousel__btn"
                            data-page="${(index + 1)}"
                            aria-controls="${(index + 1)}"
                            ?data-current="${(index + 1) === this._currentPage}"
                            @click="${() => this.goToPage(index + 1, 'auto')}">
                            ${index + 1}
                        </button>
                    `
                    )}
                </div>
            `,
            () => nothing
        );
    }

    /**
     * =========== Style
     */
    static styles = css`
        :host {
            position: relative;
            display: block;
            margin-inline: auto;
            max-width: 100%;
        }

        * {
            box-sizing: border-box;
        }

        ::slotted([z-carousel-snap-point]) {
            scroll-snap-align: start;
            scroll-snap-stop: always;
        }

        .carousel {
            position: relative;
            width: 100%;
            height: 100%;
        }

        .carousel__content {
            position: relative;
            width: 100%;
            height: 100%;
            min-height: 1px; /* fix currentPage on initialisation */
            display: grid;
            grid-auto-flow: column;
            grid-auto-columns: calc((100% - (var(--_z-carousel-gap) * (var(--_z-carousel-per-page) - 1))) / var(--_z-carousel-per-page));
            grid-auto-rows: 100%;
            column-gap: var(--_z-carousel-gap, 0);
            /* overflow: auto clip; // cant detect page change on touchmove :(
            scrollbar-width: none; */
            overflow-x: hidden;
            scroll-snap-type: x mandatory;
            scroll-padding-inline: var(--_z-carousel-offset-start) var(--_z-carousel-offset-end);
            padding-inline: var(--_z-carousel-offset-start) var(--_z-carousel-offset-end);
        }

        .carousel__content__shadow-element {
            visibility: hidden;
            pointer-events: none;
        }

        .carousel__nav {
            z-index: 1;
        }

        .carousel__btn {
            appearance: none;
            font: inherit;
            background: none;
            border: none;
        }

        .carousel__btn:hover {
            cursor: pointer;
        }

        .carousel__btn:disabled {
            cursor: not-allowed;
        }
    `
}

declare global {
    interface HTMLElementTagNameMap {
        'z-carousel': ZCarousel,
    }
}
