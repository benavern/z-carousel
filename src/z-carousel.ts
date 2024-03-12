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

  @property({ type: Number })
  step = 1;
  
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

    // react to content scroll transition end
    this._contentEl.addEventListener('scrollend', () => this._onScrollEnd());

    // navigation user events
    this._contentEl.addEventListener('keydown', (e) => this._onKeyDown(e));
    this._contentEl.addEventListener('wheel', (e) => this._onWheel(e));
  }
  
  override updated(changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>) {
    if (changedProperties.has('currentSlideIndex')) this._updateCurrentSlide();

    super.update(changedProperties);
  }
  
  /*
   * =========== Methods
   */

  private _onScrollEnd() {
    if (!this.slideElements.length) return;

    // @Todo: event afterChange(neSlideIndex)
  }

  private _onKeyDown(e: KeyboardEvent) {
    if (e.target !== this._contentEl) return;
    
    if (e.key === 'ArrowLeft') this.goToPrevious();
    if (e.key === 'ArrowRight') this.goToNext();
  }

  private _onWheel(e: WheelEvent) {
    if (e.target !== this._contentEl && !this/*._contentEl.*/.contains(e.target as Node)) return;

    if (e.deltaX < 0) this.goToPrevious();
    if (e.deltaX > 0) this.goToNext();
  }

  private _showSlide(el: HTMLElement, behavior: ScrollBehavior = 'auto') {
    // browser calculation would have been better but it makes the window scroll to the current element
    // this is not comfortable if an interval is set to loop over the carousel for example...
    // el.scrollIntoView({ block: 'nearest', inline: "nearest", behavior })

    this._contentEl.scrollTo({ left: el.offsetLeft, behavior });
  }

  private _updateCurrentSlide(behavior: ScrollBehavior = 'auto') {
    this._showSlide(this.slideElements[this._currentSlideIndex], behavior)
  }

  goToPrevious() {
    if (!this.infinit && this._isFirstSlide) return;
    this.goToIndex(this.currentSlideIndex - this.step);
  }
  
  goToNext() {
    if (!this.infinit && this._isLastSlide) return;
    this.goToIndex(this.currentSlideIndex + this.step);
  }

  goToIndex (slideIndex: number = 0) {
    if(slideIndex === this.currentSlideIndex) return;

    // @Todo: event beforerChange(neSlideIndex, oldIndex) [cancelable???]

    this.currentSlideIndex = slideIndex;
  }

  /**
   * =========== Template
   */

  render() {
    return html`
      <div class="carousel">
        <div
          class="carousel__content"
          part="content"
          tabindex="0">
          <slot></slot>
        </div>
        
        ${this._renderPrevArrow()}

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
                  ?disabled="${index === this._currentSlideIndex}"
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
      overflow-x: hidden;
    }

    .carousel__content ::slotted(*) {
      flex: 1 0 100%;
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
