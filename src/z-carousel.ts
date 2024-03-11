import { LitElement, PropertyValueMap, ReactiveElement, css, html, nothing } from 'lit';
import { customElement, property, query, queryAssignedElements } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { map } from 'lit/directives/map.js';

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
  @property({ attribute: 'current-slide-index', type: Number, reflect: true })
  currentSlideIndex = 0;

  @property({ type: Boolean })
  navigation = false;

  @property({ type: Boolean })
  infinit = false;

  @property({ type: Boolean })
  counter = false

  @property({ type: Boolean })
  dots = false
  
  @queryAssignedElements()
  private readonly slideElements!: HTMLElement[];

  /*
   * =========== Computed
   */
  @property({ attribute: false })
  private get _currentSlideIndex() {
    return ((this.currentSlideIndex % this.slideElements.length) + this.slideElements.length) % this.slideElements.length;
  }

  @property({ attribute: false })
  private get _isFirstSlide() {
    return this._currentSlideIndex === 0;
  }

  @property({ attribute: false })
  private get _isLastSlide() {
    return this._currentSlideIndex === this.slideElements.length - 1;
  }

  /*
   * =========== Lifecycle
   */
  override firstUpdated() {
    this._updateCurrentSlide('instant');

    this._contentEl.addEventListener('scrollend', (e) => this._onScrollEnd(e));
  }
  
  override updated(changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>) {
    if (changedProperties.has('currentSlideIndex')) this._updateCurrentSlide();

    super.update(changedProperties);
  }
  
  /*
   * =========== Methods
   */

  private _onScrollEnd(e: Event) {
    if (!this.slideElements.length) return;

    const scrollerEl = e.target as HTMLElement;

    const currentScroll = scrollerEl.scrollLeft;
    const stepWidth = (scrollerEl.scrollWidth + parseInt(window.getComputedStyle(scrollerEl).gap, 10)) / this.slideElements.length;

    const newIndex = Math.round(currentScroll / stepWidth);

    if (newIndex !== this.currentSlideIndex) this.currentSlideIndex = Math.floor(currentScroll / stepWidth);
  }

  private _showSlide(el: HTMLElement, behavior: ScrollBehavior = 'auto') {
    // browser calculation would have been better but it makes the window scroll to the current element
    // this is not comfortable if an interval is set to loop over the carousel for example...
    // el.scrollIntoView({ block: 'nearest', inline: "nearest", behavior }) 

    this._contentEl.scrollTo({ top: 0, left: el.offsetLeft, behavior });
  }

  private _updateCurrentSlide(behavior: ScrollBehavior = 'auto') {
    this._showSlide(this.slideElements[this._currentSlideIndex], behavior)
  }

  goToPrevious() {
    this.goToIndex(this.currentSlideIndex - 1);
  }
  
  goToNext() { 
    this.goToIndex(this.currentSlideIndex + 1);
  }

  goToIndex (slideIndex: number = 0) {
    this.currentSlideIndex = slideIndex;
  }

  /**
   * =========== Template
   */

  render() {
    return html`
      <div class="carousel">
        ${this._renderPrevArrow()}

        <div
          class="carousel__content"
          part="content"
          tabindex="0">
          <slot></slot>
        </div>

        ${this._renderNextArrow()}

        ${this._renderCounter()}

        ${this._renderDots()}
      </div>
    `
  }

  private _renderPrevArrow() {
    return when(
      this.navigation,
      () => html`
        <button
          ?disabled="${!this.infinit && this._isFirstSlide}"
          part="nav-btn nav-btn--prev ${!this.infinit && this._isFirstSlide ? 'nav-btn--disabled' : ''}"
          class="carousel__btn carousel__nav carousel__nav--prev" 
          @click="${this.goToPrevious}"
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
          ?disabled="${!this.infinit && this._isLastSlide}"
          part="nav-btn nav-btn--next ${!this.infinit && this._isLastSlide ? 'nav-btn--disabled' : ''}"
          class="carousel__btn carousel__nav carousel__nav--next" 
          @click="${this.goToNext}"
          type="button">
          <slot name="nav-next">
            &#x2BC8;
          </slot>
        </button>
      `,
      () => nothing
    );
  }

  private _renderCounter() {
    return when(
      this.counter,
      () => html`
        <div
          part="counter"
          class="carousel__counter">
          ${this._currentSlideIndex + 1} / ${this.slideElements.length}
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
          class="carousel__dots">
          <slot name="dots">
            ${map(
              this.slideElements,
              (_slideEl: HTMLElement, index: number) => html`
                <button
                  part="dots-item ${index === this._currentSlideIndex ? 'dots-item--active' : ''}"
                  class="carousel__btn"
                  data-index="${index}"
                  ?data-current="${index === this._currentSlideIndex}"
                  @click="${() => this.goToIndex(index)}">
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
      width: 100%;
      height: 100%;
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
      display: flex;
      gap: 0;
      overflow-x: auto;
      scrollbar-width: none;
      /* hide scrollbar on firefox */
      scroll-snap-type: x mandatory;
    }
    
    /* hide scrollbar on chromium */
    .carousel__content::-webkit-scrollbar {
      display: none;
    }

    .carousel__content ::slotted(*) {
      width: 100%;
      flex: 0 0 100%;
      scroll-snap-align: start;
    }

    .carousel__nav {
      z-index: 1;
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
    }

    .carousel__nav.carousel__nav--prev {
      left: 0;
    }

    .carousel__nav.carousel__nav--next {
      right: 0;
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
  `
}

declare global {
  interface HTMLElementTagNameMap {
    'z-carousel': ZCarousel,
  }
}
