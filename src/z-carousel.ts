import { LitElement, type PropertyValueMap, css, html, nothing } from 'lit';
import { customElement, eventOptions, property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { map } from 'lit/directives/map.js';
import { debounce, clamp } from './utils';

export type ZCarouselChangeEvent = CustomEvent<{ current: number; next: number }>;

interface ZCarouselEventMap extends HTMLElementEventMap {
  [ZCarousel.events.change]: ZCarouselChangeEvent;
}

@customElement('z-carousel')
export class ZCarousel extends LitElement {
    static events = {
        change: 'change',
    } as const;

    addEventListener<K extends keyof ZCarouselEventMap>(
        type: K,
        listener: (this: ZCarousel, ev: ZCarouselEventMap[K]) => any,
        options?: boolean | AddEventListenerOptions
    ): void;

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

    /**
     * =========== data
     */
    private _resizeObserver!: ResizeObserver;

    @state()
    private _isDragging = false;

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
    private _debouncedOnResize = debounce(this._onResize.bind(this), 100);
    private _onResize() {
        this._updateScroll('instant');
    }

    private _debouncedOnScroll = debounce(this._onScroll.bind(this), 100);
    private _onScroll() {
        const scrollLeft = this._contentEl.scrollLeft + this._offsetStart;

        let closestIndex = 0;
        let minDistance = Infinity;

        for (let i = 0; i < this.slideElements.length; i += this._perMove) {
            const el = this.slideElements[i];
            const distance = Math.abs(el.offsetLeft - scrollLeft);

            if (distance < minDistance) {
                minDistance = distance;
                closestIndex = i;
            }
        }

        const newPage = Math.floor(closestIndex / this._perMove) + 1;

        if (newPage !== this._currentPage && newPage >= 1 && newPage <= this._nbPages) {
            this.currentPage = newPage;
        }
    }

    private _onKeyDown(e: KeyboardEvent) {
        if (e.target !== this._contentEl) return;

        if(this.disabled) {
            e.preventDefault();
            return;
        }

        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            this.goToPreviousPage();
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            this.goToNextPage();
        }
    }

    private _onWheel(e: WheelEvent) {
        // prevent native scroll on whell horizontal scroll
        if (e.deltaX !== 0) e.preventDefault();

        if (this.disabled || e.target !== this._contentEl && !this.contains(e.target as Node)) return;

        if (e.deltaX < 0) this.goToPreviousPage();
        else if (e.deltaX > 0) this.goToNextPage();
    }

    private _onTouchStart(e: TouchEvent) {
        // prevent native scroll on touch devices when disabled
        if (this.disabled) e.preventDefault();
    }

    @eventOptions({ capture: true })
    private _onPointerDown(e: PointerEvent) {
        if (this.disabled || !this.drag || e.pointerType !== 'mouse') return;

        this._isDragging = true;
    }

    private _onPointerMove(e: PointerEvent) {
        if (!this._isDragging) return;

        this._contentEl.scrollBy({
            left: -e.movementX,
            behavior: 'instant',
        });
    }

    private _onPointerUp() {
        if (!this._isDragging) return;

        this._isDragging = false;

        // potential smooth pointer release
        this._onScroll();
        this._updateScroll('auto');
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

    goToPage(pageNumber: number = 1, behavior: ScrollBehavior = 'auto') {
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
                    style=${this._isDragging ? 'scroll-snap-type: unset' : ''}
                    @keydown="${this._onKeyDown}"
                    @wheel="${this._onWheel}"
                    @scroll="${this._debouncedOnScroll}"
                    @touchstart="${this._onTouchStart}"
                    @pointerdown="${this._onPointerDown}"
                    @pointermove="${this._onPointerMove}"
                    @pointerup="${this._onPointerUp}"
                    @pointercancel="${this._onPointerUp}">
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
                            role="option"
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
            overflow: auto clip;
            scrollbar-width: none;
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
