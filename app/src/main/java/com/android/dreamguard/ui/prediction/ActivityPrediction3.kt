package com.android.dreamguard.ui.prediction

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.capstone.dreamguard.R
import com.android.dreamguard.data.local.datastore.PredictionDataStore
import com.capstone.dreamguard.databinding.ActivityPrediction3Binding

class ActivityPrediction3 : AppCompatActivity() {

    private lateinit var binding: ActivityPrediction3Binding
    private var hoursOfSleep: Int = 8

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityPrediction3Binding.inflate(layoutInflater)
        setContentView(binding.root)

        hoursOfSleep = PredictionDataStore.hoursOfSleep.takeIf { it > 0 } ?: 8

        setupToolbar()
        setupListeners()
        updateSleepHoursDisplay()
    }

    private fun setupToolbar() {
        binding.toolbar.setNavigationOnClickListener {
            finish()
        }
    }

    private fun setupListeners() {
        binding.iconMinButton.setOnClickListener {
            if (hoursOfSleep > 0) {
                hoursOfSleep--
                updateSleepHoursDisplay()
            }
        }

        binding.iconPlusButton.setOnClickListener {
            if (hoursOfSleep < 24) {
                hoursOfSleep++
                updateSleepHoursDisplay()
            }
        }

        binding.predictButton.setOnClickListener {
            PredictionDataStore.hoursOfSleep = hoursOfSleep
            proceedToNextStep()
        }
    }

    private fun updateSleepHoursDisplay() {
        binding.ageNumber.text = hoursOfSleep.toString()
    }

    private fun proceedToNextStep() {
        if (hoursOfSleep < 0 || hoursOfSleep > 24) {
            println("Invalid sleep hours")
            return
        }
        val intent = Intent(this, ActivityPrediction4::class.java)
        startActivity(intent)
    }
}
