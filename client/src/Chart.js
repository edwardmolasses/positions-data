import { Component } from "react";
import {
  ReferenceLine,
  ReferenceArea,
  Rectangle,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from "recharts";

class LineChartComponent extends Component {
  state = {
    rawChartData: [],
    chartData: [],
    latestShortVolume: 0,
    latestLongVolume: 0,
    latestEthPrice: 0,
    offset: null
  };

  formatData = (data) =>
    data.map(({ timestamp, shortLongDiff }) => {

      return {
        date: timestamp,
        shortMinusLong: shortLongDiff
      }
    });

  gradientOffset = (data) => {
    return data.reduce(
      (previousValue, currentValue) => { return Math.abs(currentValue) > previousValue ? Math.abs(currentValue) : previousValue }, 0
    );
  };

  componentDidMount() {
    async function getChartData() {
      const response = await fetch('/api/positionsData');
      return await response.json();

      // const response = await fetch('/api/positionsDataFromContentful');
      // return await response.json();
    }

    const fetchData = async () => {
      const rawChartData = await getChartData();
      const chartData = this.formatData(rawChartData);
      const latestRecord = rawChartData[rawChartData.length - 1];

      this.setState({
        rawChartData: rawChartData,
        chartData: chartData,
        latestShortVolume: latestRecord.shortVolume,
        latestLongVolume: latestRecord.longVolume,
        latestEthPrice: latestRecord.ethPrice,
        offset: this.gradientOffset(chartData)
      });
    };
    fetchData();

    this.interval = setInterval(async () => {
      const updatedChartData = this.formatData(await getChartData());
      this.setState({ chartData: updatedChartData });
      console.log('refreshing on interval ...');
    }, 5 * 60 * 1000);
  }

  componentWillUnmount() {
    clearInterval(this.interval);
  }

  render() {
    const prettifyNum = (num) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const prettifyDate = (dateObj, showTime = true) => {
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const timeStr = showTime ? `${dateObj.getHours()}:${String(dateObj.getMinutes()).padStart(2, '0')}` : '';
      return `${monthNames[dateObj.getMonth()]} ${dateObj.getDate()} ${dateObj.getFullYear()} ${timeStr}`;
    }
    const CustomTooltip = ({ active, payload, label }) => {
      if (active && payload && payload.length) {
        const timestamp = payload[0]?.payload.date;
        const dateObj = new Date(timestamp);
        const dateStr = prettifyDate(dateObj);
        const rawDataElement = this.state.rawChartData.find(element => element.timestamp === timestamp);

        return (
          <div className="custom-tooltip" >
            <table style={{ backgroundColor: "white", borderStyle: "solid", opacity: "1" }}>
              <tbody>
                <tr>
                  <td>{dateStr}</td>
                </tr>
                <tr>
                  <td>${prettifyNum(payload[0]?.payload.shortMinusLong)}</td>
                </tr>
                {rawDataElement?.ethPrice &&
                  (
                    <tr>
                      <td>
                        <span style={{ color: "blue", fontWeight: "bold" }}>ETH:</span> ${prettifyNum(rawDataElement.ethPrice)}
                      </td>
                    </tr>
                  )}
              </tbody>
            </table>
          </div>
        );
      }

      return null;
    };
    const formatYAxis = (num) => prettifyNum(num);
    const formatXAxis = (timestamp) => {
      const date = new Date(timestamp);
      return prettifyDate(date, false);
    }
    const { chartData } = this.state;

    return (
      <>
        <h1 style={{ marginTop: "25px", marginLeft: "150px", position: "absolute" }}>GMX Short/Long Relative Volume</h1>
        <table style={{ marginTop: "30px", marginLeft: "700px", position: "absolute" }}>
          <tbody>
            <tr>
              <td>
                <b>Short Volume: </b>
              </td>
              <td style={{ textAlign: "right" }}>
                ${prettifyNum(this.state.latestShortVolume)}
              </td>
            </tr>
            <tr>
              <td>
                <b>Long Volume: </b>
              </td>
              <td style={{ textAlign: "right" }}>
                ${prettifyNum(this.state.latestLongVolume)}
              </td>
            </tr>
            <tr>
              <td>
                <b>ETH Price: </b>
              </td>
              <td style={{ textAlign: "right" }}>
                ${prettifyNum(this.state.latestEthPrice)}
              </td>
            </tr>
          </tbody>
        </table>
        <LineChart width={1000} height={700} data={chartData} margin={{ top: 120, right: 20, bottom: 100, left: 50 }}>
          <ReferenceLine y={0} stroke="orange" strokeWidth={2} strokeDasharray="3 3" />
          <ReferenceLine y={-25000000} label={{ value: 'open short here', fill: 'red', fontSize: '10px' }} stroke="blue" strokeWidth={0} strokeDasharray="5 5" />
          <ReferenceLine y={25000000} label={{ value: 'open long here', fill: 'green', fontSize: '10px' }} stroke="blue" strokeWidth={0} strokeDasharray="5 5" />
          <ReferenceArea
            y1={-25000000}
            y2={25000000}
            shape={<Rectangle />}
          />
          <Line type="monotone" dataKey="shortMinusLong" stroke="#8884d8" strokeWidth={2} dot={false} />
          <CartesianGrid stroke="#ccc" strokeWidth="5 5" />
          <XAxis dataKey="date" tickFormatter={formatXAxis} angle={-45} textAnchor="end" tick={{ fontSize: '12' }} />
          <YAxis tickFormatter={formatYAxis} domain={[-65000000, 65000000]} tick={{ fontSize: '12' }} />
          <Tooltip content={<CustomTooltip />} />
        </LineChart>
      </>
    );
  }
}

export default LineChartComponent;