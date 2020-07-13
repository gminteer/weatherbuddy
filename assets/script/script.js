/* global moment */
import {el, mount, setChildren} from 'https://redom.js.org/redom.es.min.js';

const data = JSON.parse(localStorage.getItem('weatherBuddyData')) || {lastReq: {}, previousSearches: []};
const saveData = () => localStorage.setItem('weatherBuddyData', JSON.stringify(data));

// The API supports metric or imperial units, but the user gets to choose metric or imperial so might as well just
// accept their default units (kelvin and meters/sec)
const convertTemperature = {
  imperial(tempK) {
    return `${(((tempK - 273.15) * 9) / 5 + 32).toFixed(2)}°F`;
  },
  metric(tempK) {
    return `${(tempK - 273.15).toFixed(2)}°C`;
  },
};
const convertSpeed = {
  metric(metric) {
    return `${metric.toFixed(2)} m/s`;
  },
  imperial(metric) {
    return `${(metric * 2.237).toFixed(2)} mph`;
  },
};
const currentContainer = document.querySelector('#current-weather-container');
const fiveDayContainer = document.querySelector('#five-day-container');
const previousSeachesContainer = document.querySelector('#previous-searches-container');
const settingsContainer = document.querySelector('#settings-container');
const settingsBtn = document.querySelector('#settings');
const settingsCloseBtn = document.querySelector('#settings-close');
const apiKeyInputEl = document.querySelector('#api-key-input');
const unitTypeEl = document.querySelector('#unit-type');
const errorSpan = document.querySelector('#error-span');
const errorTextEl = document.querySelector('#error-span .error-text');

// draw weather cards
function renderWeatherCardBody(bodyData) {
  const bodyEl = el('.card-body');
  for (const label of Object.keys(bodyData)) {
    const labelEl = el('h4', `${label}:`);
    mount(bodyEl, labelEl);
    const valueEl = el('span', bodyData[label]);
    mount(bodyEl, valueEl);
  }
  return bodyEl;
}
function renderWeatherCard(headerEl, iconEl, bodyEl) {
  const cardEl = el('.card');
  const titleEl = el('.card-title');
  setChildren(titleEl, headerEl);
  setChildren(cardEl, [titleEl, iconEl, bodyEl]);
  return cardEl;
}
function renderFiveDay(dailyWeather) {
  const containerEl = el('.card-row');
  for (let i = 1; i < 6; i++) {
    const day = dailyWeather[i];
    // skipping the first day because it's today's weather
    const headerEl = el('h3', moment.unix(day.dt).format('MM/DD'));
    const iconEl = el(`i.wi.wi-owm-${day.weather[0].id}.med-icon`);
    const bodyData = {
      Temperature: `${convertTemperature[data.unitType](day.temp.day)}`,
      Humidity: `${day.humidity}%`,
    };
    const bodyEl = renderWeatherCardBody(bodyData);
    mount(containerEl, renderWeatherCard(headerEl, iconEl, bodyEl));
  }
  setChildren(fiveDayContainer, containerEl);
}

function renderWeatherData(locationName, weatherData) {
  const current = weatherData.current;
  const convTemp = convertTemperature[data.unitType];
  const headerEl = [
    el('h2', locationName),
    el('h3', moment.unix(current.dt).tz(weatherData.timezone).format('MMM DD, hh:mma')),
  ];
  const iconPrefix = moment().utc().isBetween(moment.unix(current.sunrise).utc(), moment.unix(current.sunset).utc())
    ? 'day'
    : 'night';
  const iconEl = el(`i.wi.wi-owm-${iconPrefix}-${current.weather[0].id}.big-icon`);
  const bodyData = {
    Temperature: `${convTemp(current.temp)} (feels like ${convTemp(current.feels_like)}`,
    Humidity: `${current.humidity}%`,
    'Wind Speed': [
      convertSpeed[data.unitType](current.wind_speed),
      el(`i.wi.wi-wind.from-${current.wind_deg}-deg.wind-icon`),
    ],
    'UV Index': el('span#uv-index', current.uvi),
  };
  const bodyEl = renderWeatherCardBody(bodyData);
  const uvIndex = bodyEl.querySelector('#uv-index');
  const uvi = current.uvi;
  if (uvi <= 2) uvIndex.classList.add('uv-low');
  else if (uvi <= 5) uvIndex.classList.add('uv-moderate');
  else if (uvi <= 7) uvIndex.classList.add('uv-high');
  else if (uvi <= 8) uvIndex.classList.add('uv-very-high');
  else uvIndex.classList.add('uv-extreme');

  setChildren(currentContainer, renderWeatherCard(headerEl, iconEl, bodyEl));
  renderFiveDay(weatherData.daily);
}

// draw previous searches list
function renderPreviousSearches() {
  const searchContainer = el('ul.collection');
  for (const search of data.previousSearches) {
    const searchEl = el('li.collection-item', search);
    mount(searchContainer, searchEl);
  }
  setChildren(previousSeachesContainer, searchContainer);
}

// get latitude/longitude/placeName from geocode.xyz
async function fetchGeolocation(search) {
  let searchString;
  if (search.lat) searchString = `${search.lat},${search.lon}`;
  else searchString = search;
  const geolocationApiUrl = `https://geocode.xyz/${searchString}?json=1`;
  const response = await fetch(geolocationApiUrl);
  if (!response.ok) {
    showError(`${response.status}: ${response.statusText}`);
    return;
  } else {
    if (response.status === 403)
      // the public endpoint will reject with 403 if it gets too busy
      setTimeout(fetchGeolocation(search), 1000 * Math.ceil(Math.random() * 5));
  }
  const data = await response.json();
  if (data.error) {
    showError(`${data.error.description}`);
    return;
  }
  const out = {lat: data.latt, lon: data.longt};
  // reverse geolocating has a different output
  if (search.lat) out.name = data.city;
  else out.name = data.standard.city;
  return out;
}

// show/hide error messgages
errorSpan.addEventListener('click', () => errorSpan.classList.add('hide'));
function showError(errorText) {
  errorTextEl.textContent = errorText;
  errorSpan.classList.remove('hide');
}

function updatePreviousSearches() {
  // it's short, but it's logic that probably shouldn't be in fetchWeatherData
  data.previousSearches.sort((a, b) => moment(data.lastReq[b].timeStamp).diff(moment(data.lastReq[a].timeStamp)));
  if (data.previousSearches.length > 16) delete data.lastReq[data.previousSearches.pop()];
}
// get weather data from OpenWeatherMap
async function fetchWeatherData(location) {
  if (!location) return;
  if (data.lastReq[location.name]) {
    // don't hit the API for the same location more than once every 15 minutes
    const lastReq = data.lastReq[location.name];
    const timeStamp = moment(lastReq.timeStamp);
    if (moment.duration(moment().diff(timeStamp)).asMinutes() <= 15)
      return renderWeatherData(lastReq.location.name, lastReq.weatherData);
  }
  const locationQuery = `lat=${location.lat}&lon=${location.lon}`;
  const weatherApiUrl = `https://api.openweathermap.org/data/2.5/onecall?${locationQuery}&appid=${data.apiKey}`;
  const reqData = {
    timeStamp: moment(),
  };
  const response = await fetch(weatherApiUrl);
  if (!response.ok) {
    showError(`${response.status}: ${response.statusText}`);
    return;
  }
  reqData.location = location;
  reqData.weatherData = await response.json();
  data.lastReq[location.name] = reqData;
  if (!data.previousSearches.includes(location.name)) data.previousSearches.push(location.name);
  updatePreviousSearches();
  saveData();
  // hide error box if it's still visible
  if (!errorSpan.classList.contains('hide')) errorSpan.classList.add('hide');
  renderWeatherData(reqData.location.name, reqData.weatherData);
  renderPreviousSearches();
}

function formSubmitHandler(event) {
  event.preventDefault();
  const inputEl = event.target.querySelector('input[type=search]');
  const input = inputEl.value.trim().replace(/\s/g, ' ');
  inputEl.value = '';
  fetchGeolocation(input).then((location) => fetchWeatherData(location));
}
document.querySelector('#location').addEventListener('submit', formSubmitHandler);

let lastLocationBtnClick;
let locationBtnClickDebounce = false;
function locationBtnClickListener() {
  if (!lastLocationBtnClick) {
    lastLocationBtnClick = moment();
  } else if (locationBtnClickDebounce) {
    return;
  } else {
    // rate limit location button clicks to once every 5 seconds at most
    const timeDelta = moment.duration(moment().diff(lastLocationBtnClick)).asSeconds;
    if (timeDelta < 5 && !locationBtnClickDebounce) {
      setTimeout(locationBtnClickListener, 1000 * (5 - timeDelta));
      locationBtnClickDebounce = true;
      return;
    }
  }
  lastLocationBtnClick = moment();
  locationBtnClickDebounce = false;
  navigator.geolocation.getCurrentPosition(({coords}) => {
    fetchGeolocation({lat: coords.latitude, lon: coords.longitude}).then((location) => fetchWeatherData(location));
  });
}

// not hardcoding API keys into something going into a public repository
function showSettings() {
  settingsContainer.classList.remove('hide');
  if (data.apiKey) {
    if (apiKeyInputEl.classList.contains('required-field')) apiKeyInputEl.classList.remove('required-field');
    apiKeyInputEl.value = data.apiKey;
    unitTypeEl.value = data.unitType;
  } else {
    apiKeyInputEl.classList.add('required-field');
  }
}

settingsBtn.addEventListener('click', () => {
  showSettings();
});
settingsCloseBtn.addEventListener('click', () => {
  if (!apiKeyInputEl.value) {
    showError('API key cannot be blank.');
    return;
  }
  data.apiKey = apiKeyInputEl.value.trim();
  data.unitType = unitTypeEl.value;
  saveData();
  settingsContainer.classList.add('hide');
});
if (!data.apiKey) showSettings();

// display location button if browser supports geolocation requests
if (navigator.geolocation) {
  const getLocationBtn = document.querySelector('#get-location');
  getLocationBtn.classList.remove('hide');
  getLocationBtn.addEventListener('click', locationBtnClickListener);
}

// display previous searches if previous searches exist
if (data.previousSearches.length > 0) {
  previousSeachesContainer.classList.remove('hide');
  renderPreviousSearches();
  previousSeachesContainer.addEventListener('click', (event) => {
    if (data.lastReq[event.target.textContent]) fetchWeatherData(data.lastReq[event.target.textContent].location);
  });
}
