import { Directive, ElementRef, Input, OnChanges, SimpleChanges } from '@angular/core';
import JsBarcode from 'jsbarcode';

@Directive({
  selector: '[appBarcodeRender]',
  standalone: true
})
export class BarcodeRenderDirective implements OnChanges {
  @Input() value: string = '';
  @Input() format: string = 'CODE128';

  constructor(private el: ElementRef) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (this.value) {
      this.render();
    }
  }

  private render() {
    try {
      JsBarcode(this.el.nativeElement, this.value, {
        format: this.format || 'CODE128',
        lineColor: '#000000',
        width: 2,
        height: 100,
        displayValue: true,
        fontSize: 18,
        margin: 10,
        background: '#ffffff'
      });
    } catch (e) {
      console.warn('JsBarcode render fallback:', e);
      JsBarcode(this.el.nativeElement, this.value, {
        format: 'CODE128',
        displayValue: true
      });
    }
  }
}