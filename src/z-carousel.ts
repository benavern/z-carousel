import { LitElement, PropertyValueMap, ReactiveElement, css, html, nothing } from 'lit';
import { customElement, property, query, queryAssignedElements } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { map } from 'lit/directives/map.js';

const debounce = (cb: Function, delay:number = 1000) => {
  let timer:number;
  return (...args:any[]) => {
      clearTimeout(timer); // Clear of timeout if exist
      timer = setTimeout(() => {
          cb(...args); // Return the callback
      }, delay);
  };
};

@customElement('z-carousel')
export class ZCarousel extends LitElement {
  /**
   * =========== Dom References
   */
 @query('.carousel__content')
  private _contentEl!: ReactiveElement;

  /*
   * =========== Props
   */
  @property({ attribute: 'current-page', type: Number })
  currentPage = 1;

  @property({ type: Boolean })
  navigation = false;

  @property({ type: Boolean })
  infinit = false;

  @property({ type: Boolean })
  pagination = false

  @property({ type: Boolean })
  dots = false

  @property({ attribute: 'per-page', type: Number })
  perPage = 1;

  @property({ type: Number })
  gap = 0;
  
  @queryAssignedElements()
  private readonly slideElements!: HTMLElement[];

  /**
   * =========== data
   */
  private _resizeObserver!: ResizeObserver;

  /*
   * =========== Computed
   */
  @property({ attribute: false })
  private get _nbPages() {
    return Math.ceil(this.slideElements.length / this.perPage);
  }
  
  @property({ attribute: false })
  private get _canGoPrevious() {
    if (this.infinit) return true;

    return this.currentPage > 1;
  }
  
  @property({ attribute: false })
  private get _canGoNext() {
    if (this.infinit) return true;

    return this.currentPage < this._nbPages;
  }
  
  @property({ attribute: false })
  private get _nbShadowElements() {
    const elementsOnLastPage = this.slideElements.length % this.perPage;
    
    if (elementsOnLastPage === 0) return 0;

    return this.perPage - elementsOnLastPage;
  }

  /*
   * =========== Lifecycle
   */
  override firstUpdated() {

    // initialize scrollValue on init
    this.goToPage(this.currentPage, 'instant')
    
    // react to content scroll transition end
    this._contentEl.addEventListener('scrollend', () => this._onScrollEnd());

    // react to element resize
    this._resizeObserver = new ResizeObserver(this._debouncedOnResize.bind(this))
    this._resizeObserver.observe(this._contentEl);

    // navigation user events
    this._contentEl.addEventListener('keydown', (e) => this._onKeyDown(e));
    this._contentEl.addEventListener('wheel', (e) => this._onWheel(e));
  }
  
  override updated(changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>) {
    if (changedProperties.has('currentPage')) this._updateScroll();

    super.update(changedProperties);
  }

  disconnectedCallback(): void {
      super.disconnectedCallback();

      this._resizeObserver.disconnect();
  }
  
  /*
   * =========== Methods
   */

  private _onScrollEnd() {
    if (!this.slideElements.length) return;

    // @Todo: event afterChange(neSlideIndex)
  }

  private _debouncedOnResize =  debounce(this._onResize.bind(this) , 200);
  private _onResize() {
    this._updateScroll('instant');
  }

  private _onKeyDown(e: KeyboardEvent) {
    if (e.target !== this._contentEl) return;
    
    if (e.key === 'ArrowLeft') this.goToPreviousPage();
    if (e.key === 'ArrowRight') this.goToNextPage();
  }

  private _onWheel(e: WheelEvent) {
    if (e.target !== this._contentEl && !this/*._contentEl.*/.contains(e.target as Node)) return;

    if (e.deltaX < 0) this.goToPreviousPage();
    if (e.deltaX > 0) this.goToNextPage();
  }

  private _updateScroll(behavior: ScrollBehavior = 'auto') {
    const _currentSlideIndex = (this.currentPage - 1) * this.perPage;

    this._contentEl.scrollTo({ left: this.slideElements[_currentSlideIndex].offsetLeft, behavior });
  }

  goToPreviousPage(behavior: ScrollBehavior = 'auto') {
    if (!this._canGoPrevious) return

    this.goToPage(this.currentPage === 1 ? this._nbPages : (this.currentPage - 1), behavior);
  }
  
  goToNextPage(behavior: ScrollBehavior = 'auto') {
    if (!this._canGoNext) return

    this.goToPage(this.currentPage === this._nbPages ? 1 : (this.currentPage + 1), behavior);
  }

  goToPage (pageNumber: number = 0, behavior: ScrollBehavior = 'auto') {
    if (this.currentPage !== pageNumber) this.currentPage = pageNumber;
    
    this._updateScroll(behavior);
  }

  /**
   * =========== Template
   */
  render() {
    return html`
      <style>
        :host {
          /* OVERRIDES the user set style */
          --_z-carousel-gap: ${this.gap}px;
          --_z-carousel-per-page: ${this.perPage};
          --_z-carousel-item-width: calc((100% - (var(--_z-carousel-gap) * (var(--_z-carousel-per-page) - 1))) / var(--_z-carousel-per-page));
        }
      </style>

      <div class="carousel">
        <div
          :style="--per-page: ${this.perPage}"
          class="carousel__content"
          part="content"
          tabindex="0">
          <slot></slot>

          ${this._renderShadowElements()}
        </div>
        
        ${this._renderPrevArrow()}

        ${this._renderNextArrow()}

        ${this._renderPagination()}

        ${this._renderDots()}
      </div>
    `
  }

  private _renderShadowElements() {
    return Array.from({ length: this._nbShadowElements }, () => html`<div class="carousel__content__shadow-element"></div>`);
  }

  private _renderPrevArrow() {
    return when(
      this.navigation,
      () => html`
        <button
          ?disabled="${!this._canGoPrevious}"
          part="nav-btn nav-btn--prev ${!this._canGoPrevious ? 'nav-btn--disabled' : ''}"
          class="carousel__btn carousel__nav carousel__nav--prev" 
          @click="${() => this.goToPreviousPage()}"
          type="button">
          <slot name="nav-prev">
            &#x2BC7;
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
          ?disabled="${!this._canGoNext}"
          part="nav-btn nav-btn--next ${!this._canGoNext ? 'nav-btn--disabled' : ''}"
          class="carousel__btn carousel__nav carousel__nav--next" 
          @click="${() => this.goToNextPage()}"
          type="button">
          <slot name="nav-next">
            &#x2BC8;
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
          part="pagination"
          class="carousel__pagination">
          ${this.currentPage} / ${this._nbPages}
        </div>
      `,
      () => nothing
    );
  }

  private _renderDots() {
    // follow pagination instead of _currentIndex ?
    return when(
      this.dots,
      () => html`
        <div
          part="dots"
          class="carousel__dots">
          <slot name="dots">
            ${map(
              Array.from({ length: this._nbPages }) as HTMLElement[],
              (_slideEl: HTMLElement, index: number) => html`
                <button
                  ?disabled="${(index + 1) === this.currentPage}"
                  part="dots-item ${(index + 1) === this.currentPage ? 'dots-item--active' : ''}"
                  class="carousel__btn"
                  data-page="${(index + 1)}"
                  ?data-current="${(index + 1) === this.currentPage}"
                  @click="${() => this.goToPage(index + 1, 'auto')}">
                  &bull;
                </button>
              `
            )}
          </slot>
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

    .carousel {
      position: relative;
      width: 100%;
      height: 100%;
    }
    
    .carousel__content {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 1px; /* fix currentPage on initialisation so that  */
      display: flex;
      gap: var(--_z-carousel-gap, 0);
      overflow-x: hidden;
    }

    .carousel__content ::slotted(*),
    .carousel__content > * {
      width: var(--_z-carousel-item-width, 100%);
      flex: 1 0 var(--_z-carousel-item-width, 100%);
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
