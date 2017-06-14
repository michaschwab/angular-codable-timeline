import { NgModule, ModuleWithProviders } from "@angular/core";
import { CommonModule } from "@angular/common";
import * as d3 from "d3";
import { CodableTimelineComponent } from "./codable-timeline.component";

export * from "./codable-timeline.component";

@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [
    CodableTimelineComponent
  ],
  exports: [
    CodableTimelineComponent
  ]
})
export class CodableTimelineModule {
  static forRoot(): ModuleWithProviders {
    return {
      ngModule: CodableTimelineModule,
      providers: []
    };
  }
}
