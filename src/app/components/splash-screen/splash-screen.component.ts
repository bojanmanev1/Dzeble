import { Component, EventEmitter, OnInit, OnDestroy, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-splash-screen',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './splash-screen.component.html',
  styleUrls: ['./splash-screen.component.scss']
})
export class SplashScreenComponent implements OnInit, OnDestroy {
  @Output() finished = new EventEmitter<void>();

  public isFadingOut = false;

  private fadeTimer?: any;
  private finishTimer?: any;

  ngOnInit() {
    // 1. Start fade-out at 1.5s when the animation finishes
    this.fadeTimer = setTimeout(() => {
      this.isFadingOut = true;
    }, 1500);

    // 2. Remove splash component completely at 1.9s
    this.finishTimer = setTimeout(() => {
      this.finished.emit();
    }, 1900);
  }

  // Allow instant skip on user tap
  dismiss() {
    if (this.isFadingOut) return;
    this.isFadingOut = true;
    setTimeout(() => {
      this.finished.emit();
    }, 300);
  }

  ngOnDestroy() {
    if (this.fadeTimer) clearTimeout(this.fadeTimer);
    if (this.finishTimer) clearTimeout(this.finishTimer);
  }
}
