import React, { useState, useCallback, useEffect } from "react";
import { Button } from "../UI";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "./Modal";
import { useDatabaseService } from "../../contexts/DatabaseContext";
import type { WeatherLog } from "../../types";

export interface WeatherLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: number;
  weatherId?: string; // For editing existing weather log
  onWeatherLogged?: (weatherLog: WeatherLog) => void;
}

export const WeatherLogModal: React.FC<WeatherLogModalProps> = ({
  isOpen,
  onClose,
  tripId,
  weatherId,
  onWeatherLogged,
}) => {
  const db = useDatabaseService();
  const [formData, setFormData] = useState({
    timeOfDay: "AM",
    sky: "",
    windCondition: "",
    windDirection: "",
    waterTemp: "",
    airTemp: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const isEditing = weatherId !== undefined;

  const loadWeatherData = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const weather = await db.getWeatherLogById(id);
      if (weather) {
        setFormData({
          timeOfDay: weather.timeOfDay,
          sky: weather.sky,
          windCondition: weather.windCondition,
          windDirection: weather.windDirection,
          waterTemp: weather.waterTemp,
          airTemp: weather.airTemp,
        });
      } else {
        setError('Weather log not found');
      }
    } catch (err) {
      console.error('Error loading weather log:', err);
      setError('Failed to load weather data');
    } finally {
      setIsLoading(false);
    }
  }, [db]);

  useEffect(() => {
    if (isOpen) {
      if (isEditing && weatherId) {
        loadWeatherData(weatherId);
      } else {
        setFormData({
          timeOfDay: "AM",
          sky: "",
          windCondition: "",
          windDirection: "",
          waterTemp: "",
          airTemp: "",
        });
      }
      setError(null);
    }
  }, [isOpen, isEditing, weatherId, loadWeatherData]);

  const handleInputChange = useCallback((field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError(null);
  }, [error]);

  const validateForm = useCallback((): boolean => {
    if (!formData.timeOfDay.trim()) {
      setError("Time of day is required");
      return false;
    }
    return true;
  }, [formData]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const weatherData: Omit<WeatherLog, "id"> = {
        tripId,
        timeOfDay: formData.timeOfDay,
        sky: formData.sky.trim(),
        windCondition: formData.windCondition.trim(),
        windDirection: formData.windDirection.trim(),
        waterTemp: formData.waterTemp.trim(),
        airTemp: formData.airTemp.trim(),
      };

      let savedData: WeatherLog;
      if (isEditing && weatherId) {
        await db.updateWeatherLog({ id: weatherId, ...weatherData });
        savedData = { id: weatherId, ...weatherData };
      } else {
        const newId = await db.createWeatherLog(weatherData);
        savedData = { id: newId.toString(), ...weatherData };
      }

      if (onWeatherLogged) onWeatherLogged(savedData);
      onClose();
    } catch (err) {
      console.error(`Error ${isEditing ? 'updating' : 'creating'} weather log:`, err);
      setError(`Failed to ${isEditing ? 'update' : 'save'} weather log. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  }, [db, formData, isEditing, onClose, onWeatherLogged, tripId, validateForm, weatherId]);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="2xl">
      <ModalHeader
        title={isEditing ? "Edit Weather Log" : "Add Weather Log"}
        subtitle={isEditing ? "Update weather conditions for this trip" : "Record weather conditions for this trip"}
        onClose={onClose}
      />
      <form onSubmit={handleSubmit}>
        <ModalBody className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--error-background)', border: '1px solid var(--error-border)' }}>
              <div className="flex items-center">
                <i className="fas fa-exclamation-triangle mr-2" style={{ color: 'var(--error-text)' }}></i>
                <span className="text-sm" style={{ color: 'var(--error-text)' }}>{error}</span>
              </div>
            </div>
          )}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="ml-3" style={{ color: 'var(--secondary-text)' }}>Loading weather data...</span>
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="timeOfDay" className="form-label" style={{ color: 'var(--primary-text)' }}>Time of Day *</label>
                <select id="timeOfDay" value={formData.timeOfDay} onChange={(e) => handleInputChange("timeOfDay", e.target.value)} className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ backgroundColor: 'var(--input-background)', border: '1px solid var(--border-color)', color: 'var(--primary-text)' }} required>
                  <option value="">Select time of day...</option>
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
              <div>
                <label htmlFor="sky" className="form-label" style={{ color: 'var(--primary-text)' }}>Sky Condition</label>
                <select id="sky" value={formData.sky} onChange={(e) => handleInputChange("sky", e.target.value)} className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ backgroundColor: 'var(--input-background)', border: '1px solid var(--border-color)', color: 'var(--primary-text)' }}>
                  <option value="">Select sky condition...</option>
                  <option value="Sunny">Sunny</option>
                  <option value="Partly Cloudy">Partly Cloudy</option>
                  <option value="Overcast">Overcast</option>
                  <option value="Light Rain">Light Rain</option>
                  <option value="Heavy Rain">Heavy Rain</option>
                  <option value="Stormy">Stormy</option>
                </select>
              </div>
              <div>
                <label htmlFor="windCondition" className="form-label" style={{ color: 'var(--primary-text)' }}>Wind Condition</label>
                <select id="windCondition" value={formData.windCondition} onChange={(e) => handleInputChange("windCondition", e.target.value)} className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ backgroundColor: 'var(--input-background)', border: '1px solid var(--border-color)', color: 'var(--primary-text)' }}>
                  <option value="">Select wind condition...</option>
                  <option value="Calm">Calm</option>
                  <option value="Light Winds">Light Winds</option>
                  <option value="Moderate Winds">Moderate Winds</option>
                  <option value="Strong Winds">Strong Winds</option>
                  <option value="Gale Force">Gale Force</option>
                </select>
              </div>
              <div>
                <label htmlFor="windDirection" className="form-label" style={{ color: 'var(--primary-text)' }}>Wind Direction</label>
                <select id="windDirection" value={formData.windDirection} onChange={(e) => handleInputChange("windDirection", e.target.value)} className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ backgroundColor: 'var(--input-background)', border: '1px solid var(--border-color)', color: 'var(--primary-text)' }}>
                  <option value="">Select wind direction...</option>
                  <option value="N">North</option>
                  <option value="NE">Northeast</option>
                  <option value="E">East</option>
                  <option value="SE">Southeast</option>
                  <option value="S">South</option>
                  <option value="SW">Southwest</option>
                  <option value="W">West</option>
                  <option value="NW">Northwest</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="waterTemp" className="form-label" style={{ color: 'var(--primary-text)' }}>Water Temperature (°C)</label>
                  <input type="number" id="waterTemp" min="0" max="40" step="0.1" value={formData.waterTemp} onChange={(e) => handleInputChange("waterTemp", e.target.value)} placeholder="15.5" className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ backgroundColor: 'var(--input-background)', border: '1px solid var(--border-color)', color: 'var(--primary-text)' }} />
                </div>
                <div>
                  <label htmlFor="airTemp" className="form-label" style={{ color: 'var(--primary-text)' }}>Air Temperature (°C)</label>
                  <input type="number" id="airTemp" min="-10" max="50" step="0.1" value={formData.airTemp} onChange={(e) => handleInputChange("airTemp", e.target.value)} placeholder="18.0" className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ backgroundColor: 'var(--input-background)', border: '1px solid var(--border-color)', color: 'var(--primary-text)' }} />
                </div>
              </div>
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <div className="flex justify-end w-full space-x-3">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting} disabled={isSubmitting || isLoading}>
              {isSubmitting ? (isEditing ? 'Updating…' : 'Saving…') : (isEditing ? 'Update Weather' : 'Save Weather')}
            </Button>
          </div>
        </ModalFooter>
      </form>
    </Modal>
  );
};

export default WeatherLogModal;