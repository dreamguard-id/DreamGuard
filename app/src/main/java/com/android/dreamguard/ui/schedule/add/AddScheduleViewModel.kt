package com.android.dreamguard.ui.schedule.add

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.icu.util.Calendar
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.android.dreamguard.data.local.database.ScheduleDatabase
import com.android.dreamguard.data.remote.api.ApiConfig
import com.android.dreamguard.data.remote.models.ScheduleEntity
import com.android.dreamguard.data.remote.models.SleepScheduleRequest
import com.android.dreamguard.utils.AlarmReceiver
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class AddScheduleViewModel(private val context: Context) : ViewModel() {
    private val dao = ScheduleDatabase.getInstance(context).scheduleDao()

    private val _addScheduleResult = MutableLiveData<Boolean>()
    val addScheduleResult: LiveData<Boolean> = _addScheduleResult

    private val _errorMessage = MutableLiveData<String>()
    val errorMessage: LiveData<String> = _errorMessage

    fun addSleepSchedule(bedTime: String, wakeUpTime: String, wakeUpAlarm: Boolean, sleepReminders: Boolean) {
        val apiService = ApiConfig.getApiService(context)

        val request = SleepScheduleRequest(
            bedTime = bedTime,
            wakeUpTime = wakeUpTime,
            wakeUpAlarm = wakeUpAlarm,
            sleepReminders = sleepReminders
        )

        viewModelScope.launch {
            try {
                val response = apiService.addSleepSchedule(request)
                if (response.isSuccessful) {
                    _addScheduleResult.value = true
                    val apiSchedule = response.body()
                    apiSchedule?.let {
                        val localSchedule = ScheduleEntity(
                            id = it.id,
                            bedTime = it.bedTime,
                            wakeUpTime = it.wakeUpTime,
                            wakeUpAlarm = it.wakeUpAlarm,
                            sleepReminders = it.sleepReminders,
                            plannedDuration = it.plannedDuration,
                            actualBedTime = it.actualBedTime,
                            actualWakeUpTime = it.actualWakeUpTime,
                            actualDuration = it.actualDuration,
                            difference = it.difference,
                            sleepQuality = it.sleepQuality,
                            notes = it.notes,
                            createdAt = it.createdAt
                        )
                        dao.insertSchedule(localSchedule)

                        setAlarm(localSchedule)
                    }
                } else {
                    _addScheduleResult.value = false
                    _errorMessage.value = "Failed to add schedule: ${response.message()}"
                }
            } catch (e: Exception) {
                _addScheduleResult.value = false
                _errorMessage.value = "Error: ${e.message}"
            }
        }
    }

    fun updateSleepSchedule(scheduleId: String, bedTime: String, wakeUpTime: String, wakeUpAlarm: Boolean, sleepReminders: Boolean) {
        val apiService = ApiConfig.getApiService(context)

        val request = SleepScheduleRequest(
            id = scheduleId,
            bedTime = bedTime,
            wakeUpTime = wakeUpTime,
            wakeUpAlarm = wakeUpAlarm,
            sleepReminders = sleepReminders
        )

        viewModelScope.launch {
            try {
                val response = apiService.updateSleepSchedule(scheduleId, request)
                if (response.isSuccessful) {
                    _addScheduleResult.value = true
                } else {
                    _addScheduleResult.value = false
                    _errorMessage.value = "Failed to add schedule: ${response.message()}"
                }
            } catch (e: Exception) {
                _errorMessage.postValue("Error: ${e.message}")
            }
        }
    }

    fun setAlarm(schedule: ScheduleEntity) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

        // Set Bedtime Alarm
        schedule.bedTime?.let {
            val bedTimeCalendar = parseTimeToCalendar(it)
            val bedTimeIntent = Intent(context, AlarmReceiver::class.java).apply {
                putExtra("TITLE", "Time to Sleep!")
                putExtra("MESSAGE", "It's bedtime, start preparing for sleep.")
            }
            val bedTimePendingIntent = PendingIntent.getBroadcast(
                context,
                schedule.localId * 2,
                bedTimeIntent,
                PendingIntent.FLAG_UPDATE_CURRENT
            )
            alarmManager.setExactAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                bedTimeCalendar.timeInMillis,
                bedTimePendingIntent
            )
        }

        // Set Wake Up Alarm
        schedule.wakeUpTime?.let {
            val wakeUpCalendar = parseTimeToCalendar(it)
            val wakeUpIntent = Intent(context, AlarmReceiver::class.java).apply {
                putExtra("TITLE", "Wake Up!")
                putExtra("MESSAGE", "It's time to wake up and start your day.")
            }
            val wakeUpPendingIntent = PendingIntent.getBroadcast(
                context,
                schedule.localId * 2 + 1, // Unique ID for wake-up alarm
                wakeUpIntent,
                PendingIntent.FLAG_UPDATE_CURRENT
            )
            alarmManager.setExactAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                wakeUpCalendar.timeInMillis,
                wakeUpPendingIntent
            )
        }
    }

    private fun parseTimeToCalendar(time: String): Calendar {
        val format = SimpleDateFormat("hh:mm a", Locale.ENGLISH)
        val date = format.parse(time) ?: Date()
        return Calendar.getInstance().apply {
            this.time = date
        }
    }


}
