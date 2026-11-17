import { Directive, ElementRef, OnInit, OnDestroy } from '@angular/core';

@Directive({
  selector: '[appLockSheetDrag], .modal-body, .settings-wrapper, .add-widget-sheet-wrapper, .auth-prompt-sheet',
  standalone: true
})
export class LockSheetDragDirective implements OnInit, OnDestroy {
  private stopMove = (e: Event) => {
    const target = e.target as HTMLElement | null;
    if (target && target.closest('.leaflet-container, [class*="leaflet"], .pharmacy-map-wrapper, .gas-map-wrapper, .atm-map-wrapper')) {
      return;
    }
    e.stopPropagation();
  };

  constructor(private el: ElementRef) {}

  ngOnInit() {
    const el = this.el.nativeElement;
    el.addEventListener('touchmove', this.stopMove, { passive: true });
    el.addEventListener('pointermove', this.stopMove, { passive: true });
  }

  ngOnDestroy() {
    const el = this.el.nativeElement;
    el.removeEventListener('touchmove', this.stopMove);
    el.removeEventListener('pointermove', this.stopMove);
  }
}
