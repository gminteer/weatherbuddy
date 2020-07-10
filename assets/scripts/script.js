import { el, mount, setChildren } from 'https://redom.js.org/redom.es.min.js';

const API_KEY = '***REMOVED***'; // having this exposed is a Bad Idea®
const data = JSON.parse(localStorage.getItem('weatherBuddyData')) || { lastReq: {} };

// The API supports requesting fahrenheit/celsius directly, but doing it locally cuts down on potential API hits
const kelvinToFahrenheit = (tempK) => ((tempK - 273.15) * 9) / 5 + 32;
const kelvinToCelsius = (tempK) => tempK - 273.15;
// The API also supports requesting speeds in mph instead of meters/sec, but flexibility
const metricSpeedToMph = (metric) => metric * 2.237;

const currentContainer = document.querySelector('#current-weather-container');
const fiveDayContainer = document.querySelector('#five-day-container');

function renderFiveDay(fiveDay) {
  setChildren(fiveDayContainer, null);
  for (let i = 0; i < fiveDay.list.length; i += 8) {
    const weather = fiveDay.list[i];
    // skipping by 8 because we get forecasts for every 3 hours
    console.log(moment.unix(weather.dt).format('MMM DD, YYYY hh:mma'));
    const column = el('.col.s2');
    const dayCard = el('.card.z-index-2');
    const titleEl = el('div.card-title.center', moment.unix(weather.dt).format('MM[/]DD'));
    const cardBody = el('.card-content.center');
    const cardBodyIcon = el(`i.wi.wi-owm-${weather.weather[0].id}.med-icon`);
    const weatherDetails = el('ul.collection');
    const condition = el('li.collection-item', `${weather.weather[0].main}`);
    const temperature = el('li.collection-item', `${kelvinToFahrenheit(weather.main.temp).toFixed(2)}°F`);
    const humidity = el('li.collection-item', `Humidity: ${weather.main.humidity}%`);
    setChildren(weatherDetails, [condition, temperature, humidity]);
    setChildren(cardBody, [cardBodyIcon, weatherDetails]);
    setChildren(dayCard, [titleEl, cardBody]);
    setChildren(column, dayCard);
    mount(fiveDayContainer, column);
  }
}

function renderWeatherData(current, fiveDay) {
  const titleEl = el(
    'div.card-title.center',
    `${current.name} - ${moment.unix(current.dt).format('MMM DD, YYYY hh:mma')}`
  );
  const cardBody = el('.card-content.center');
  const cardBodyIcon = el(`i.wi.wi-owm-${current.weather[0].id}.big-icon`);
  const weatherDetails = el('ul.collection');
  const currentCondition = el('li.collection-item', `${current.weather[0].main} then ${current.weather[1].main}`);
  const temperature = el(
    'li.collection-item',
    `Temperature: ${kelvinToFahrenheit(current.main.temp).toFixed(2)}°F (feels like ${kelvinToFahrenheit(
      current.main.feels_like
    ).toFixed(2)})`
  );
  const humidity = el('li.collection-item', `Humidity: ${current.main.humidity}%`);
  const wind = el('li.collection-item', [
    `Wind Speed: ${metricSpeedToMph(current.wind.speed).toFixed(2)} MPH    `,
    el(`i.wi.wi-wind.from-${current.wind.deg}`, { style: { 'font-size': '1.5rem' } }),
  ]);
  const uvIndex = el('li.collection-item', el('span'));
  setChildren(weatherDetails, [currentCondition, temperature, humidity, wind]);
  setChildren(cardBody, [cardBodyIcon, weatherDetails]);

  setChildren(currentContainer, [titleEl, cardBody]);
  renderFiveDay(fiveDay);
}

async function fetchWeatherData(locationQuery) {
  const endPoints = {
    current: 'weather',
    fiveDay: 'forecast',
  };
  const apiUrl = `https://api.openweathermap.org/data/2.5/{endpoint}?${locationQuery}&appid=${API_KEY}`;
  const reqData = {
    timeStamp: moment(),
  };
  if (!data.lastReq) data.lastReq = {}; // can remove this after one run
  //if (data.lastReq[locationQuery]) {
  //  const lastReq = data.lastReq[locationQuery];
  //  const timeStamp = moment(lastReq.timeStamp);
  //  if (moment.duration(moment().diff(timeStamp)).minutes() <= 15) {
  //    // don't hit the API for the same location more than once every 15 minutes
  //    return renderWeatherData(lastReq.current, lastReq.fiveDay);
  //  }
  //}
  //let response = await fetch(apiUrl.replace('{endpoint}', endPoints.current));
  //reqData.current = await response.json();
  //response = await fetch(apiUrl.replace('{endpoint}', endPoints.fiveDay));
  //reqData.fiveDay = await response.json();
  //data.lastReq[locationQuery] = reqData
  //localStorage.setItem('weatherBuddyData', JSON.stringify(data));
  //renderWeatherData(reqData.current, reqData.fiveDay);
  renderWeatherData(data.testCurrent, data.testFiveDay);
}

function formSubmitHandler(event) {
  event.preventDefault();
  const input = event.target.querySelector('input[type=search]').value.trim().replace(/\s/g, ' ');
  const locationQuery = `q=${input}`;
  fetchWeatherData(locationQuery);
}
document.querySelector('#location').addEventListener('submit', formSubmitHandler);

if (navigator.geolocation) {
  const getLocationBtn = document.querySelector('#get-location');
  getLocationBtn.classList.remove('hide');
  getLocationBtn.addEventListener('click', () => {
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const locationQuery = `lat=${coords.latitude}&lon=${coords.longitude}`;
      fetchWeatherData(locationQuery);
    });
  });
}
