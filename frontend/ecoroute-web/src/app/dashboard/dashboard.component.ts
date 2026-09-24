import {
  AfterViewInit,
  Component,
  OnDestroy
} from '@angular/core';

import { Chart } from 'chart.js/auto';

import * as L from 'leaflet';


@Component({
  selector: 'app-dashboard',

  imports: [],

  templateUrl: './dashboard.component.html',

  styleUrl: './dashboard.component.scss'
})


export class DashboardComponent implements AfterViewInit, OnDestroy {

  private wasteChart?: Chart;

  private map?: L.Map;

  isMapExpanded = false;

  toggleMapSize(): void {

  this.isMapExpanded = !this.isMapExpanded;

  setTimeout(() => {

    this.map?.invalidateSize();

  }, 500);

}

  ngAfterViewInit(): void {

    this.createWasteChart();

    this.createCollectionMap();

  }


  private createWasteChart(): void {

    const canvas = document.getElementById(
      'wasteChart'
    ) as HTMLCanvasElement | null;


    if (!canvas) {
      return;
    }


    this.wasteChart = new Chart(
      canvas,
      {
        type: 'line',

        data: {

          labels: [
            'Sun',
            'Mon',
            'Tue',
            'Wed',
            'Thur',
            'Fri',
            'Sat'
          ],

          datasets: [
            {
              data: [
                20,
                40,
                30,
                50,
                67,
                89,
                56
              ],

              borderColor: '#0b9435',

              backgroundColor: 'rgba(11, 148, 53, 0.12)',

              borderWidth: 2,

              pointRadius: 4,

              pointHoverRadius: 6,

              pointBackgroundColor: '#0b9435',

              pointBorderColor: '#ffffff',

              pointBorderWidth: 2,

              fill: true,

              tension: 0.15
            }
          ]

        },


        options: {

          responsive: true,

          maintainAspectRatio: false,

          plugins: {

            legend: {
              display: false
            },

            tooltip: {
              callbacks: {
                label: (context) => {
                  return `${context.parsed.y},000 kg`;
                }
              }
            }

          },


          scales: {

            y: {

              beginAtZero: true,

              max: 100,

              ticks: {
                stepSize: 20,

                callback: (value) => {
                  return `${value}k`;
                }
              },

              title: {
                display: true,
                text: 'KG'
              },

              grid: {
                color: '#e5e7eb'
              }

            },


            x: {

              grid: {
                color: '#e5e7eb'
              }

            }

          }

        }

      }

    );

  }


  private createCollectionMap(): void {

    const mapElement = document.getElementById(
      'collectionMap'
    );


    if (!mapElement) {
      return;
    }


    /*
     * Talamban, Cebu City
     *
     * These coordinates are prototype route coordinates.
     * They will eventually come from the backend.
     */

    const talamban: L.LatLngExpression = [
      10.3765,
      123.9570
    ];


    this.map = L.map(
      mapElement,
      {
        zoomControl: false
      }
    ).setView(
      talamban,
      14
    );


    L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution:
          '&copy; OpenStreetMap contributors',

        maxZoom: 19
      }
    ).addTo(this.map);


    /*
     * ROUTE 1
     */

    const routeOne: L.LatLngExpression[] = [

      [10.3825, 123.9480],

      [10.3785, 123.9525],

      [10.3740, 123.9570],

      [10.3715, 123.9625],

      [10.3680, 123.9660]

    ];


    /*
     * ROUTE 2
     */

    const routeTwo: L.LatLngExpression[] = [

      [10.3850, 123.9600],

      [10.3810, 123.9640],

      [10.3770, 123.9680],

      [10.3730, 123.9710],

      [10.3690, 123.9750]

    ];


    /*
     * ROUTE 3
     */

    const routeThree: L.LatLngExpression[] = [

      [10.3720, 123.9490],

      [10.3680, 123.9530],

      [10.3640, 123.9570],

      [10.3610, 123.9620]

    ];


    L.polyline(
      routeOne,
      {
        color: '#0b9435',
        weight: 4
      }
    ).addTo(this.map);


    L.polyline(
      routeTwo,
      {
        color: '#ef4444',
        weight: 4
      }
    ).addTo(this.map);


    L.polyline(
      routeThree,
      {
        color: '#1683e8',
        weight: 4
      }
    ).addTo(this.map);


    this.addRouteMarkers(
      routeOne,
      '#0b9435'
    );


    this.addRouteMarkers(
      routeTwo,
      '#ef4444'
    );


    this.addRouteMarkers(
      routeThree,
      '#1683e8'
    );


    /*
     * Zoom control
     */

    L.control.zoom({
      position: 'bottomright'
    }).addTo(this.map);


    setTimeout(() => {

      this.map?.invalidateSize();

    }, 200);

  }


private addRouteMarkers(
  route: L.LatLngExpression[],
  color: string
): void {

  if (!this.map) {
    return;
  }

  route.forEach(
    (coordinate, index) => {

      const marker = L.circleMarker(
        coordinate,
        {
          radius: 11,

          color: '#ffffff',

          weight: 2,

          fillColor: color,

          fillOpacity: 1
        }
      )
        .addTo(this.map!);


      marker.bindTooltip(
        `${index + 1}`,
        {
          permanent: true,

          direction: 'center',

          className: 'route-number'
        }
      );


      // Route #03 information
      if (index === 2 && color === '#0b9435') {

        marker.bindPopup(
          `
            <strong>Route #03</strong><br>
            Vehicle #02<br>
            6 / 10 stops<br>
            ETA: 3:45 PM
          `
        );

      }

    }
  );

}


  ngOnDestroy(): void {

    this.wasteChart?.destroy();

    this.map?.remove();

  }

}