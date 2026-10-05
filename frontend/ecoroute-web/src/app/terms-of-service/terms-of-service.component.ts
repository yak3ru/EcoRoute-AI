import {
  Component,
  ElementRef,
  QueryList,
  ViewChild,
  ViewChildren
} from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-terms-of-service',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './terms-of-service.component.html',
  styleUrl: './terms-of-service.component.scss'
})
export class TermsOfServiceComponent {

  activeSection = 1;

  @ViewChild('termsContent')
  termsContent!: ElementRef<HTMLDivElement>;

  @ViewChildren('termSection')
  termSections!: QueryList<ElementRef<HTMLElement>>;

  sections = [
    { number: 1, title: 'Purpose and Scope' },
    { number: 2, title: 'Authorized Use and Account' },
    { number: 3, title: 'User Responsibilities' },
    { number: 4, title: 'Prohibited Uses' },
    { number: 5, title: 'Prediction and Route Outputs' },
    { number: 6, title: 'Internet and External Services' },
    { number: 7, title: 'Intellectual Property' },
    { number: 8, title: 'Academic and Research Nature' },
    { number: 9, title: 'Availability and Changes' },
    { number: 10, title: 'Disclaimer and Limitation of Liability' },
    { number: 11, title: 'Suspension or Termination' },
    { number: 12, title: 'Changes to These Terms' },
    { number: 13, title: 'Contact and Acceptance' }
  ];

scrollToSection(number: number): void {
  const section = this.termSections
    .toArray()
    .find(
      item =>
        item.nativeElement.dataset['section'] === String(number)
    );

  if (!section) {
    return;
  }

  const container = this.termsContent.nativeElement;
  const sectionElement = section.nativeElement;

  const containerTop = container.getBoundingClientRect().top;
  const sectionTop = sectionElement.getBoundingClientRect().top;

  const scrollPosition =
    container.scrollTop +
    (sectionTop - containerTop) -
    10;

  container.scrollTo({
    top: scrollPosition,
    behavior: 'smooth'
  });

  this.activeSection = number;
}
}