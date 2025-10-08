import React from 'react';

const Logs = ({ logs, logContainerRef }) => {
  return (
    <div className="log-card">
      <div className="log-container" ref={logContainerRef}>
        {logs.length === 0 ? (
          <div className="log-empty">No logs yet</div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="log-entry">
              {log}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Logs;
