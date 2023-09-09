import React, {useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import {openDatabase} from 'react-native-sqlite-storage';
import cities from 'cities.json';
import {
  Collapse,
  CollapseHeader,
  CollapseBody,
} from 'accordion-collapse-react-native';
import LinearGradient from 'react-native-linear-gradient';
import Canvas from 'react-native-canvas';
import weatherIconPath from './data/weatherIconPath';
import {PermissionsAndroid} from 'react-native';
import {API_KEY} from '@env';

const db = openDatabase({name: 'weather'});

const App = () => {
  const ref = useRef(null);
  const [dataList, setDataList] = useState([]);
  const [lat, setLat] = useState(0);
  const [lon, setLon] = useState(0);
  const [weatherTemp, setWeatherTemp] = useState(0);
  const [weatherMain, setWeatherMain] = useState('');
  const [weatherDescription, setWeatherDescription] = useState('');
  const [icon, setIcon] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [day, setDay] = useState('');
  const [city, setCity] = useState('');
  const [finalCity, setFinalCity] = useState('');
  const [country, setCountry] = useState('');
  const [citiesArr, setCitiesArr] = useState([]);
  const [flag, setFlag] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState([]);

  let width = Dimensions.get('window').width;
  let height = Dimensions.get('window').height;

  const createTables = () => {
    db.transaction(txn => {
      txn.executeSql(
        `CREATE TABLE IF NOT EXISTS cities (id INTEGER PRIMARY KEY AUTOINCREMENT, city VARCHAR(40), country VARCHAR(5), temp INTEGER, weather VARCHAR(20), date VARCHAR(20),time VARCHAR(20))`,
        [],
        (sqlTxn, res) => {
          console.log('Table created successfully');
        },
        error => {
          console.log('error on created table' + error.message);
        },
      );
    });
  };

  const getHistory = () => {
    db.transaction(txn => {
      txn.executeSql(
        `SELECT * FROM cities ORDER BY id DESC`,
        [],
        (sqlTxn, res) => {
          console.log('HISTORY cities retrieved successfully');
          let len = res.rows.length;

          if (len > 0) {
            let results = [];
            for (let i = 0; i < len; i++) {
              let item = res.rows.item(i);
              results.push({
                id: item.id,
                city: item.city,
                country: item.country,
                temp: item.temp,
                weather: item.weather,
                date: item.date,
                time: item.time,
              });
            }
            setHistory(results);
          }
        },
        error => {
          console.log('error on getting cities ' + error.message);
        },
      );
    });
  };

  const clearHistory = () => {
    db.transaction(txn => {
      txn.executeSql(
        `DROP TABLE  cities;`,
        [],
        (sqlTxn, res) => {
          console.log('Table deleted successfully');
          setHistory([]);
          createTables();
        },
        error => {
          console.log('error on delete table' + error.message);
        },
      );
    });
  };

  const renderHistory = ({item}) => {
    return (
      <View
        style={{
          flexDirection: 'column',
          justifyContent: 'space-between',
          paddingVertical: 12,
          paddingHorizontal: 10,
          marginRight: 5,
          borderBottomWidth: 1,
          borderRadius: 5,
          borderColor: '#888',
          borderWidth: 1,
        }}>
        <Text>{item.city}</Text>
        <Text>{item.country}</Text>
        <Text>{item.temp}°C</Text>
        <Text>{item.weather}</Text>
        <Text>{item.date}</Text>
        <Text>{item.time}</Text>
      </View>
    );
  };

  const getWeekDay = date => {
    let dateYear = date.split('-')[0];
    let dateMonth = date.split('-')[1] - 1;
    let dateDay = date.split('-')[2];
    let itemDate = new Date(dateYear, dateMonth, dateDay);
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
    }).format(itemDate);
  };

  const renderForecast = ({item}) => {
    let date = item.dt_txt.split(' ')[0];
    let time = item.dt_txt.split(' ')[1];
    time = time.substr(0, time.length - 3);
    let dateNow = new Date();
    let month = +dateNow.getMonth() + 1;
    if (month < 10) month = '0' + month;
    let dayMonth = dateNow.getDate();
    if (dayMonth < 10) dayMonth = '0' + dayMonth;
    let curDate = date;
    if (dateNow.getFullYear() + '-' + month + '-' + dayMonth == date)
      curDate = 'Today';

    let itemWeekDay = getWeekDay(date);

    let temp = item?.main?.temp;
    let main = item?.weather[0]?.main;
    let description = item?.weather[0]?.description;
    let icon = item?.weather[0]?.icon;
    return (
      <TouchableOpacity
        style={styles.forecast_card}
        onPress={() =>
          getForecastWeather(temp, main, date, time, description, icon)
        }>
        <Text>{curDate}</Text>
        <Text>{itemWeekDay}</Text>
        <Text>{time}</Text>
      </TouchableOpacity>
    );
  };

  const addHistory = (city, country, temp, main, date, time) => {
    db.transaction(txn => {
      txn.executeSql(
        `INSERT INTO cities (city,country,temp,weather,date,time) VALUES (?,?,?,?,?,?)`,
        [city, country, temp, main, date, time],
        (sqlTxn, res) => {
          console.log(`${city} in cities added successfully`);
          getHistory();
        },
        error => {
          console.log('error on adding city ' + error.message);
        },
      );
    });
  };

  const getWeather = async (lat, lon, city, country) => {
    const weather = await fetch(
      `http://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`,
    );
    const data = await weather.json();
    setDataList(data?.list);
    let temp = data?.list[0].main?.temp;
    let main = data?.list[0].weather[0]?.main;
    let description = data?.list[0].weather[0]?.description;
    let icon = data?.list[0].weather[0]?.icon;
    let date = data?.list[0].dt_txt.split(' ')[0];
    let time = data?.list[0].dt_txt.split(' ')[1];
    time = time.substr(0, time.length - 3);
    let itemWeekDay = getWeekDay(date);
    setWeatherTemp(temp);
    setWeatherMain(main);
    setWeatherDescription(description);
    setIcon(icon);
    setDate(date);
    setTime(time);
    setDay(itemWeekDay);
    addHistory(city, country, temp, main, date, time);
    console.log('City=', city, 'lat=', lat, 'lon=', lon);
  };

  const getForecastWeather = (temp, main, date, time, description, icon) => {
    setWeatherTemp(temp);
    setWeatherMain(main);
    setWeatherDescription(description);
    setIcon(icon);
    setDate(date);
    setTime(time);
    let itemWeekDay = getWeekDay(date);
    setDay(itemWeekDay);
    addHistory(city, country, temp, main, date, time);
  };

  const getLocationWeather = async () => {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'GPS Permission',
          message: 'The app needs access to your location ',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );
      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        console.log('You can use the location');
        Geolocation.getCurrentPosition(position => {
          setLat(Number(position.coords.latitude));
          setLon(Number(position.coords.longitude));
          setFinalCity('Location: ');
          setCountry(
            position.coords.latitude + ',' + position.coords.longitude,
          );
          getWeather(
            Number(position.coords.latitude),
            Number(position.coords.longitude),
            'Local position',
            '',
          );
        });
      } else {
        console.log('GPS permission denied');
      }
    } catch (err) {
      console.warn(err);
    }
  };

  const renderCitiesArr = ({item}) => {
    return (
      <View style={{flexDirection: 'column', marginRight: 10}}>
        {item.map((it, ind) => (
          <TouchableOpacity
            style={styles.city_card}
            key={ind}
            onPress={() =>
              handleCityPress(it.name, it.country, it.lat, it.lng)
            }>
            <Text style={styles.h3}>{it.name + ' "' + it.country + '"'}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const handleCityPress = async (
    cityName,
    country,
    lat = 50.45466,
    lng = 30.5238,
  ) => {
    setFlag(false);
    setCity(cityName);
    setFinalCity(cityName);
    setCountry(country);
    setLat(lat);
    setLon(lng);
    setIsLoading(true);
    await getWeather(lat, lng, cityName, country);
    setIsLoading(false);
  };

  useEffect(() => {
    createTables();
    getHistory();
    handleCityPress('Kyiv', 'UA');
  }, []);

  useEffect(() => {
    if (!flag) return;
    setCitiesArr([]);
    let regExp = new RegExp(`^${city}`, 'i');
    let filteredCities = cities.filter(city => city.name.match(regExp));
    let arr = [];
    let arr2 = [];
    let counter = 0;
    for (let i = 0; i < 500; i++) {
      counter++;
      let res = filteredCities[i];
      if (filteredCities[i]) arr2.push(res);
      if (counter == 5) {
        arr.push(arr2);
        arr2 = [];
        counter = 0;
      }
    }
    arr ? setCitiesArr(arr) : setCitiesArr([]);
  }, [city]);

  useEffect(() => {
    if (ref.current) {
      let xV = 169 + +lon;
      let yH = 96 - +lat;
      const ctx = ref.current.getContext('2d');

      ctx.clearRect(0, 0, 360, 236);
      ref.current.width = 360;
      ref.current.height = 176;

      ctx.beginPath();
      ctx.moveTo(xV, 0);
      ctx.lineTo(xV, 236);
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, yH);
      ctx.lineTo(360, yH);
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }, [lon, lat]);

  return (
    <SafeAreaView>
      <LinearGradient
        colors={['#035ff8', '#449df8', '#ffd904']}
        style={styles.lineagradient}></LinearGradient>

      <ScrollView>
        <View style={{width: '100%', alignItems: 'center'}}>
          <Image
            style={styles.logo}
            source={require('./assets/logo250-70.png')}></Image>
        </View>
        <View style={styles.view_forecast}>
          <View style={styles.card}>
            <Text style={[styles.h5, {textAlign: 'center', marginBottom: 5}]}>
              FORECAST (5 days)
            </Text>
            <FlatList horizontal data={dataList} renderItem={renderForecast} />
            <Text style={[styles.h5, {textAlign: 'left', marginTop: 10}]}>
              {date}&nbsp;&nbsp; {day}&nbsp;&nbsp;{time}
            </Text>
            <View style={styles.town}>
              <Text style={styles.h1}>{finalCity}</Text>
              <Text style={styles.h1}>"{country}"</Text>
            </View>

            <Text style={[styles.h4, {textAlign: 'left'}]}>
              {weatherMain} ({weatherDescription})
            </Text>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
              }}>
              <Text style={styles.h1}>{weatherTemp.toFixed(0)}°C</Text>
              {icon && (
                <Image
                  style={{
                    width: 70,
                    height: 70,
                    marginLeft: 10,
                  }}
                  source={weatherIconPath[icon]}></Image>
              )}
            </View>
          </View>

          <View style={styles.map_view}>
            <Image
              style={styles.map_image}
              source={require('./assets/map1.jpg')}></Image>
            <Canvas ref={ref} />
          </View>

          <TouchableOpacity
            style={[styles.button_blue, {marginTop: 35}]}
            onPress={getLocationWeather}>
            <Text style={styles.button_text}>My location weather</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.searching_card}>
            <Text style={[styles.text_middle, {marginStart: 10}]}>
              The town's searching
            </Text>
            <TextInput
              placeholder="Enter town"
              style={styles.searching_card_input}
              value={city}
              onChange={() => setFlag(true)}
              onChangeText={setCity}
            />
          </TouchableOpacity>

          {citiesArr && (
            <View style={[styles.card, styles.card2]}>
              <FlatList
                horizontal
                data={citiesArr}
                renderItem={renderCitiesArr}
              />
            </View>
          )}

          <View style={[styles.history_main, styles.card]}>
            <View>
              <Collapse>
                <CollapseHeader
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginBottom: 10,
                  }}>
                  <Text style={styles.h2}>HISTORY</Text>

                  <TouchableOpacity
                    style={styles.button_blue}
                    onPress={clearHistory}>
                    <Text style={styles.button_text}>Clear</Text>
                  </TouchableOpacity>
                </CollapseHeader>
                <CollapseBody>
                  <FlatList
                    horizontal
                    data={history}
                    renderItem={renderHistory}
                    key={city => city.id}
                  />
                </CollapseBody>
              </Collapse>
            </View>
          </View>
        </View>
      </ScrollView>
      {isLoading && (
        <View style={styles.view_indicator}>
          <ActivityIndicator size="large" color="white" />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  h1: {
    color: '#000',
    fontSize: 25,
    fontWeight: '700',
    textAlign: 'center',
  },

  h2: {
    color: '#111',
    fontSize: 23,
    fontWeight: '500',
    marginVertical: 5,
    textAlign: 'left',
  },
  h3: {
    color: '#222',
    fontSize: 18,
    fontWeight: '400',

    textAlign: 'left',
  },
  h4: {
    color: '#333',
    fontSize: 16,
    fontWeight: '400',

    textAlign: 'left',
  },
  h5: {
    color: '#222',
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'left',
  },
  card: {
    backgroundColor: '#aaa7',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#888',

    width: '100%',
    padding: 15,
    marginVertical: 10,
  },
  card2: {
    height: 250,
    color: '#000',
    fontSize: 20,
    fontWeight: '400',
  },

  history_main: {
    maxHeight: 500,
  },
  city_card: {
    backgroundColor: '#aaa7',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#888',

    padding: 5,
    marginVertical: 3,
  },
  searching_card: {
    width: '100%',
    padding: 10,
    marginVertical: 20,
  },
  searching_card_input: {
    width: '100%',
    padding: 10,
    marginVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fff',
    fontSize: 20,
    color: '#333',
  },
  button_blue: {
    alignItems: 'center',
    backgroundColor: '#035ff8',
    paddingVertical: 7,
    paddingHorizontal: 20,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#888',
  },
  button_text: {
    fontSize: 20,
    color: 'white',
  },
  text_middle: {
    fontSize: 20,
    color: '#fff',
  },
  forecast_card: {
    flexDirection: 'column',
    backgroundColor: '#ffd904bb',
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginRight: 5,
    marginBottom: 15,
    borderBottomWidth: 1,
    borderRadius: 5,
    borderColor: '#888',
    borderWidth: 1,
  },
  map_view: {
    position: 'relative',
    width: '100%',
    alignItems: 'center',
    marginTop: 15,
  },
  map_image: {
    position: 'absolute',
    width: 360,
    height: 176,
  },
  view_indicator: {
    backgroundColor: '#00000088',
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    width: '100%',
    justifyContent: 'center',
    zIndex: 100,
  },
  lineagradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    width: '100%',
  },
  logo: {
    width: 250,
    height: 70,
    marginTop: 10,
  },
  view_forecast: {
    alignItems: 'center',
    paddingHorizontal: 15,
    width: '100%',
  },
  town: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
});

export default App;
