import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-waste-data',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './waste-data.component.html',
  styleUrl: './waste-data.component.scss'
})
export class WasteDataComponent {

  wasteAreas = [
    {
      name: 'Maryville',
      value: 61529,
      color: '#00c853'
    },
    {
      name: 'Silverhills',
      value: 41543,
      color: '#4f7cac'
    },
    {
      name: 'Sunny Hills',
      value: 52546,
      color: '#ff9800'
    },
    {
      name: 'Joseville',
      value: 87002,
      color: '#8b5cf6'
    },
    {
      name: 'Garnetville',
      value: 10196,
      color: '#ef4444'
    }
  ];

  areaParameters = [
    {
      area: 'Silverhills Subdivision',
      density: 'High',
      activity: 'High',
      frequency: 'Daily'
    },
    {
      area: 'Maryville Subdivision',
      density: 'Medium',
      activity: 'Low',
      frequency: '3x / week'
    },
    {
      area: 'Garnetville',
      density: 'High',
      activity: 'Medium',
      frequency: 'Daily'
    },
    {
      area: 'Zone 67',
      density: 'Low',
      activity: 'Medium',
      frequency: '2x / week'
    },
    {
      area: 'Area 25',
      density: 'High',
      activity: 'High',
      frequency: 'Daily'
    }
  ];

  recentCollections = [
    {
      date: 'Sept 24, 2026',
      area: 'Silverhills Subdivision',
      type: 'Biodegradable',
      weight: '1,240 kg',
      status: 'Completed'
    },
    {
      date: 'Sept 24, 2026',
      area: 'Garnetville',
      type: 'Non biodegradable',
      weight: '850 kg',
      status: 'Completed'
    },
    {
      date: 'Sept 23, 2026',
      area: 'Zone 67',
      type: 'Non biodegradable',
      weight: '420 kg',
      status: 'Pending'
    },
    {
      date: 'Sept 23, 2026',
      area: 'Maryville Subdivision',
      type: 'Biodegradable',
      weight: '980 kg',
      status: 'Completed'
    },
    {
      date: 'Sept 22, 2026',
      area: 'Sunny Hills',
      type: 'Biodegradable',
      weight: '1,150 kg',
      status: 'Completed'
    },
    {
      date: 'Sept 22, 2026',
      area: 'Silverhills Subdivision',
      type: 'Non biodegradable',
      weight: '710 kg',
      status: 'Failed'
    }
  ];

  searchTerm = '';
  wasteTypeFilter = 'All';

  get maxWaste(): number {
    return Math.max(
      ...this.wasteAreas.map(area => area.value)
    );
  }

  getBarWidth(value: number): number {
    return (value / this.maxWaste) * 100;
  }

  get filteredCollections() {

  const search = this.searchTerm
    .toLowerCase()
    .trim();

  return this.recentCollections.filter(collection => {

    const areaMatch =
      collection.area
        .toLowerCase()
        .includes(search);

    const typeMatch =
      this.wasteTypeFilter === 'All' ||
      collection.type === this.wasteTypeFilter;

    return areaMatch && typeMatch;
  });
}
}