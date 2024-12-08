package com.android.dreamguard.ui.prediction

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.capstone.dreamguard.R
import com.android.dreamguard.data.local.datastore.PredictionDataStore
import com.capstone.dreamguard.databinding.ActivityPrediction7Binding

class ActivityPrediction7 : AppCompatActivity() {

    private lateinit var binding: ActivityPrediction7Binding
    private var weight: Int = 60 // Default weight in kg
    private var height: Int = 170 // Default height in cm

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityPrediction7Binding.inflate(layoutInflater)
        setContentView(binding.root)

        setupToolbar()
        setupListeners()
        updateWeightDisplay()
        updateHeightDisplay()
    }

    private fun setupToolbar() {
        binding.toolbar.setNavigationOnClickListener {
            onBackPressedDispatcher.onBackPressed()
        }
    }

    private fun setupListeners() {
        // Weight
        binding.iconMinButtonStr.setOnClickListener {
            if (weight > 1) {
                weight--
                updateWeightDisplay()
            }
        }

        binding.iconPlusButtonStr.setOnClickListener {
            if (weight < 300) { // Max weight threshold
                weight++
                updateWeightDisplay()
            }
        }

        // Height
        binding.iconMinButton.setOnClickListener {
            if (height > 50) { // Min height threshold
                height--
                updateHeightDisplay()
            }
        }

        binding.iconPlusButton.setOnClickListener {
            if (height < 250) { // Max height threshold
                height++
                updateHeightDisplay()
            }
        }

        binding.predictButton.setOnClickListener {
            PredictionDataStore.weight = weight
            PredictionDataStore.height = height
            proceedToNextStep()
        }
    }

    private fun updateWeightDisplay() {
        binding.ageNumberStr.text = "$weight kg"
    }

    private fun updateHeightDisplay() {
        binding.ageNumber.text = "$height cm"
    }

    private fun proceedToNextStep() {
        if (weight < 1 || weight > 300 || height < 50 || height > 250) {
            println("Invalid weight or height values")
            return
        }
        val intent = Intent(this, ActivityPrediction8::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        finish()
    }
}
