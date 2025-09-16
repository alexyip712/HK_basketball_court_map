document.addEventListener('DOMContentLoaded', () => {
    try {
        const map = new maplibregl.Map({
            container: 'map',
            style: {
                'version': 8,
                'sources': {
                    'osm-tiles': {
                        'type': 'raster',
                        'tiles': ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                        'tileSize': 256,
                        'attribution': '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    }
                },
                'glyphs': 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
                'layers': [{
                    'id': 'osm-tiles',
                    'type': 'raster',
                    'source': 'osm-tiles',
                    'minzoom': 9,
                    'maxzoom': 21
                }]
            },
            center: [114.17475, 22.367533],
            zoom: 12,
            minZoom: 10,
            maxZoom: 19,
            maxBounds: [[113.75, 22.15], [114.481, 22.571]]
        });

        // Initialize map with compact attribution control
        map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

        // disable map rotation using right click + drag
        map.dragRotate.disable();

        // disable map rotation using keyboard
        map.keyboard.disable();

        // disable map rotation using touch rotation gesture
        map.touchZoomRotate.disableRotation();

        const layerControl = {
            '體育館': { layerId: 'sports-grounds', labelId: 'sports-grounds-labels', color: 'blue' },
            '街場': { layerId: 'recreation-grounds', labelId: 'recreation-grounds-labels', color: 'green' }
        };

        let currentPopup = null;
        let longPressTimer = null;
        let debounceTimer = null;

        const searchInput = document.getElementById('searchInput');
        const suggestions = document.getElementById('suggestions');
        const districtSelect = document.getElementById('districtFilter');
        const clearButton = document.getElementById('clearFilter');
        const info = document.getElementById('info');
        const toggleIcon = document.getElementById('toggleCard');

        function getHashSuffix(cate) {
            switch (cate) {
                case '體育館': return 'SC';
                case '街場': return 'SB';
                default: return '';
            }
        }

        function updateInfo(properties) {
            const branchStatus = document.getElementById('branchStatus');
            const branchName = document.getElementById('branchName');
            const branchDetail = document.getElementById('branchDetail');
            const branchDistrict = document.getElementById('branchdistrict');
            const facilities = document.getElementById('facilities');
            const other = document.getElementById('other');
            const phone = document.getElementById('phone');
            const opening_hours = document.getElementById('opening_hours');
            const number = document.getElementById('number');
            const closeButton = document.querySelector('.close');

            facilities.innerHTML = properties.NSEARCH01_TC && properties.NSEARCH01_TC !== 'N.A.' ? `<li>其他設施：${properties.NSEARCH01_TC}</li>` : '<li>其他設施：未提供</li>';
            phone.innerHTML = properties.NSEARCH03_TC && properties.NSEARCH03_TC !== 'N.A.' ? `<li>電話：${properties.NSEARCH03_TC}</li>` : '<li>電話：未提供</li>';
            opening_hours.innerHTML = properties.NSEARCH02_TC && properties.NSEARCH02_TC !== 'N.A.' ? `<li>開放時間：${properties.NSEARCH02_TC}</li>` : '<li>開放時間：未提供</li>';
            number.innerHTML = properties.No__of_Basketball_Courts_TC ? `<li>籃球場數目：${properties.No__of_Basketball_Courts_TC}</li>` : '<li>籃球場數目：未提供</li>';

            if (properties) {
                info.classList.remove('card-hidden');
                branchStatus.className = layerControl[properties.DATASET_TC].color;
                branchStatus.textContent = properties.DATASET_TC;
                branchName.textContent = properties.NAME_TC;
                branchDetail.textContent = properties.ADDRESS_TC;
                branchDistrict.textContent = properties.SEARCH01_TC;
                toggleIcon.style.display = window.innerWidth <= 835 ? 'block' : 'none';
                closeButton.onclick = () => {
                    info.classList.add('card-hidden');
                    history.pushState({}, '', window.location.pathname);
                    document.title = '香港籃球場地圖'; // Reset title when closing info card
                };
                toggleIcon.onclick = () => {
                    const isExpanded = info.classList.toggle('expanded');
                    toggleIcon.innerHTML = isExpanded ? '<i class="fas fa-chevron-down"></i>' : '<i class="fas fa-chevron-up"></i>';
                    toggleIcon.setAttribute('aria-label', isExpanded ? '收起資訊卡' : '展開資訊卡');
                };
                // Update document title with venue name
                document.title = `${properties.NAME_TC}籃球場 | 香港籃球場地圖`;
            } else {
                info.classList.add('card-hidden');
                document.title = '香港籃球場地圖'; // Reset title when no properties
            }
        }

        function filterData(searchTerm, district) {
            let filteredFeatures = geodatastore.features;
            filteredFeatures = filteredFeatures.map(f => ({
                ...f,
                properties: {
                    ...f.properties,
                    clean_name_chi: f.properties.NAME_TC.replace(/\s*\(.*\)/, '')
                }
            }));
            if (searchTerm) {
                searchTerm = searchTerm.toLowerCase();
                filteredFeatures = filteredFeatures.filter(f =>
                    f.properties.NAME_TC.toLowerCase().includes(searchTerm) ||
                    f.properties.ADDRESS_TC.toLowerCase().includes(searchTerm) ||
                    f.properties.SEARCH01_TC.toLowerCase().includes(searchTerm)
                );
            }
            if (district) {
                filteredFeatures = filteredFeatures.filter(f => f.properties.SEARCH01_TC === district);
            }
            return {
                type: 'FeatureCollection',
                features: filteredFeatures
            };
        }

        function updateSuggestions(searchTerm) {
            suggestions.innerHTML = '';
            if (!searchTerm) {
                suggestions.style.display = 'none';
                return;
            }
            const filtered = filterData(searchTerm, '').features.slice(0,);
            if (filtered.length) {
                filtered.forEach(f => {
                    const div = document.createElement('div');
                    div.className = 'suggestion-item';
                    div.textContent = f.properties.NAME_TC + (f.properties.DATASET_TC === '體育館' ? '' : ' (街場)');
                    div.setAttribute('role', 'option');
                    div.onclick = () => {
                        searchInput.value = f.properties.NAME_TC;
                        updateInfo(f.properties);
                        map.flyTo({ center: f.geometry.coordinates, zoom: 16.9, essential: true });
                        history.pushState({}, '', `?name=${encodeURIComponent(f.properties.NAME_TC)}&type=${getHashSuffix(f.properties.DATASET_TC)}`);
                        suggestions.style.display = 'none';
                    };
                    suggestions.appendChild(div);
                });
                suggestions.style.display = 'block';
            } else {
                suggestions.style.display = 'none';
            }
        }

        map.on('load', () => {
            // Set default document title on load
            document.title = '香港籃球場地圖';
            map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');

            class GeolocationControl {
                onAdd(map) {
                    this._map = map;
                    this._container = document.createElement('div');
                    this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
                    const button = document.createElement('button');
                    button.className = 'geolocation-button';
                    button.innerHTML = '<i class="fas fa-location-arrow"></i>';
                    button.title = '定位到當前位置';
                    button.onclick = () => {
                        if (navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition((position) => {
                                map.flyTo({ center: [position.coords.longitude, position.coords.latitude], zoom: 16.9, essential: true });
                            }, () => {
                                alert('無法獲取定位，請允許地理位置權限');
                            });
                        } else {
                            alert('您的瀏覽器不支援地理定位');
                        }
                    };
                    this._container.appendChild(button);
                    return this._container;
                }
                onRemove() {
                    this._container.parentNode.removeChild(this._container);
                    this._map = undefined;
                }
            }
            map.addControl(new GeolocationControl(), 'top-left');

            map.addSource('basketball-courts', {
                type: 'geojson',
                data: geodatastore
            });

            for (const [label, { layerId, color }] of Object.entries(layerControl)) {
                map.addLayer({
                    id: layerId,
                    type: 'circle',
                    source: 'basketball-courts',
                    filter: ['==', ['get', 'DATASET_TC'], label],
                    paint: {
                        'circle-color': color,
                        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 5, 15, 12, 18, 18],
                        'circle-opacity': 0.7,
                        'circle-stroke-width': 1
                    }
                });

                map.addLayer({
                    id: `${layerId}-labels`,
                    type: 'symbol',
                    source: 'basketball-courts',
                    minzoom: 14,
                    filter: ['==', ['get', 'DATASET_TC'], label],
                    layout: {
                        'text-field': ['get', 'NAME_TC'],
                        'text-font': ['Noto Sans TC Bold'],
                        'text-size': 12,
                        'text-offset': [0, 1.4],
                        'text-anchor': 'top'
                    },
                    paint: {
                        'text-halo-color': '#fff',
                        'text-halo-width': 2
                    }
                });
            }

            // Add cursor change on hover for circle layers
            map.on('mousemove', (e) => {
                const features = map.queryRenderedFeatures(e.point, {
                    layers: Object.values(layerControl).map(l => l.layerId)
                });
                map.getCanvas().style.cursor = features.length ? 'pointer' : 'grab';
            });

            map.on('click', (e) => {
                const features = map.queryRenderedFeatures(e.point, {
                    layers: Object.values(layerControl).map(l => l.layerId)
                });
                if (features.length) {
                    const feature = features[0];
                    updateInfo(feature.properties);
                    map.flyTo({ center: feature.geometry.coordinates, zoom: 16.9, essential: true });
                    history.pushState({}, '', `?name=${encodeURIComponent(feature.properties.NAME_TC)}&type=${getHashSuffix(feature.properties.DATASET_TC)}`);
                }
            });

            const urlParams = new URLSearchParams(window.location.search);
            const fieldName = urlParams.get('name');
            const fieldType = urlParams.get('type');
            if (fieldName && fieldType) {
                const feature = geodatastore.features.find(f => f.properties.NAME_TC === fieldName && getHashSuffix(f.properties.DATASET_TC) === fieldType);
                if (feature) {
                    map.flyTo({ center: feature.geometry.coordinates, zoom: 16.9, essential: true });
                    updateInfo(feature.properties);
                }
            }

            const districts = [...new Set(geodatastore.features.map(f => f.properties.SEARCH01_TC))];
            districts.forEach(district => {
                const option = document.createElement('option');
                option.value = district;
                option.textContent = district;
                districtSelect.appendChild(option);
            });

            const layerControlDiv = document.createElement('div');
            layerControlDiv.className = 'layer-control';
            const toggleLayerContainer = document.createElement('div');
            toggleLayerContainer.className = 'toggle-layer-container';
            const toggleLayerTitle = document.createElement('span');
            toggleLayerTitle.style.fontWeight = 'bold';
            const toggleLayerIcon = document.createElement('span');
            toggleLayerIcon.className = 'toggle-layer-icon';
            toggleLayerIcon.innerHTML = '<i class="fa-solid fa-filter"></i>';
            toggleLayerIcon.setAttribute('aria-label', '展開圖層控制');
            toggleLayerContainer.appendChild(toggleLayerTitle);
            toggleLayerContainer.appendChild(toggleLayerIcon);
            layerControlDiv.appendChild(toggleLayerContainer);
            const layerContent = document.createElement('div');
            layerContent.className = 'layer-content';
            for (const [label, { layerId, labelId, color }] of Object.entries(layerControl)) {
                const div = document.createElement('div');
                div.style.padding = '5px';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = `${layerId}-checkbox`;
                checkbox.checked = true;
                checkbox.addEventListener('change', () => {
                    map.setLayoutProperty(layerId, 'visibility', checkbox.checked ? 'visible' : 'none');
                    map.setLayoutProperty(labelId, 'visibility', checkbox.checked ? 'visible' : 'none');
                });
                const labelElem = document.createElement('label');
                labelElem.htmlFor = `${layerId}-checkbox`;
                const iconSpan = document.createElement('span');
                iconSpan.textContent = color === 'blue' ? '🔵' : '🟢';
                iconSpan.style.marginRight = '5px';
                iconSpan.setAttribute('aria-label',
                    color === 'blue' ? '藍色圓點表示體育館' : '綠色圓點表示街場');
                labelElem.appendChild(iconSpan);
                labelElem.appendChild(document.createTextNode(label));
                div.appendChild(checkbox);
                div.appendChild(labelElem);
                layerContent.appendChild(div);
            }
            layerControlDiv.appendChild(layerContent);

            toggleLayerIcon.onclick = () => {
                const isCollapsed = layerControlDiv.classList.toggle('collapsed');
                toggleLayerIcon.innerHTML = isCollapsed ? '<i class="fa-solid fa-filter"></i>' : '<i class="fa fa-chevron-up"></i>';
                toggleLayerIcon.setAttribute('aria-label', isCollapsed ? '展開圖層控制' : '收起圖層控制');
            };

            const existingLayerControl = document.querySelector('.layer-control');
            if (existingLayerControl) {
                existingLayerControl.remove();
            }
            if (window.innerWidth <= 835) {
                document.getElementById('searchFilter').appendChild(layerControlDiv);
                layerControlDiv.classList.add('collapsed');
            } else {
                document.body.appendChild(layerControlDiv);
            }

            window.addEventListener('resize', () => {
                const existingLayerControl = document.querySelector('.layer-control');
                if (existingLayerControl) {
                    existingLayerControl.remove();
                }
                if (window.innerWidth <= 835) {
                    document.getElementById('searchFilter').appendChild(layerControlDiv);
                    layerControlDiv.classList.add('collapsed');
                } else {
                    document.body.appendChild(layerControlDiv);
                    layerControlDiv.classList.remove('collapsed');
                }
            });

            searchInput.addEventListener('input', () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    const data = filterData(searchInput.value, districtSelect.value);
                    map.getSource('basketball-courts').setData(data);
                    updateSuggestions(searchInput.value);
                    if (data.features.length && searchInput.value) {
                        map.flyTo({ center: data.features[0].geometry.coordinates, zoom: 16.9, essential: true });
                    }
                }, 300);
            });

            searchInput.addEventListener('blur', () => {
                setTimeout(() => suggestions.style.display = 'none', 200);
            });

            districtSelect.addEventListener('change', () => {
                const data = filterData(searchInput.value, districtSelect.value);
                map.getSource('basketball-courts').setData(data);
                updateSuggestions(searchInput.value);
                if (data.features.length) {
                    map.flyTo({ center: data.features[0].geometry.coordinates, zoom: 16.9, essential: true });
                }
            });

            clearButton.addEventListener('click', () => {
                searchInput.value = '';
                districtSelect.value = '';
                suggestions.style.display = 'none';
                info.classList.add('card-hidden');
                history.pushState({}, '', window.location.pathname);
                map.getSource('basketball-courts').setData(filterData('', ''));
                map.flyTo({ center: [114.17475, 22.337533], zoom: 11, essential: true });
                document.title = '香港籃球場地圖'; // Reset title on clear
            });

            map.on('zoomend', () => {
                if (map.getZoom() >= map.getMaxZoom()) {
                    const alertDiv = document.createElement('div');
                    alertDiv.className = 'zoom-alert';
                    alertDiv.textContent = '已達到最大縮放';
                    map.getContainer().appendChild(alertDiv);
                    setTimeout(() => alertDiv.remove(), 2000);
                }
            });
        });

        map.on('error', (e) => {
            console.error('MapLibre 錯誤:', e);
        });

        map.on('tileerror', (e) => {
            console.error('圖磚加載錯誤:', e);
        });

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').then(() => {
                console.log('Service Worker 註冊成功');
            }).catch(err => {
                console.error('Service Worker 註冊失敗:', err);
            });
        }

    } catch (e) {
        console.error('初始化錯誤:', e);
    }
});